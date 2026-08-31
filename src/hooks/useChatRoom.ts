/**
 * Owns the chat room socket: the join ticket, the connection, the reconnect
 * backoff, and the message window the UI renders.
 *
 * Delivery is push, not polling — a message reaches other tabs as soon as the
 * Durable Object fans it out. The only timer here is a keepalive, which the
 * server answers without waking the room.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatConnectionStatus,
  ChatMessage,
  ChatTicket,
} from "../types/chat";
import { ChatApiError } from "../types/chat";
import {
  chatSocketUrl,
  clearCachedTicket,
  isChatConfigured,
  loadCachedTicket,
  requestChatTicket,
  storeTicket,
} from "../lib/chat/api";
import {
  CHAT_MESSAGE_CAP,
  CHAT_PING_FRAME,
  CHAT_PING_INTERVAL_MS,
  CHAT_PONG_TIMEOUT_MS,
  CHAT_PONG_FRAME,
  CHAT_RECONNECT_DELAYS_MS,
} from "../lib/chat/config";
import { appendWithCap, isChatMessage } from "../lib/chat/rules";

export interface ChatRoomController {
  status: ChatConnectionStatus;
  messages: ChatMessage[];
  participants: number;
  /** Own display handle, assigned by the server on join. */
  handle: string | null;
  /** Last server refusal (moderation, rate limit). Cleared on the next send. */
  notice: string | null;
  /** Last failure that stopped the visitor getting in. */
  error: string | null;
  isJoining: boolean;
  join: (turnstileToken: string) => void;
  /** Returns false when the socket is not open, so the composer keeps the text. */
  send: (body: string) => boolean;
  clearNotice: () => void;
}

/**
 * Shortest gap between connection attempts triggered by regaining focus.
 *
 * Long enough that a phone waking and re-locking cannot open a socket per event,
 * short enough that returning to the tab still feels immediate.
 */
export const VISIBILITY_RETRY_MIN_GAP_MS = 1_500;

/**
 * Failed handshakes before the held ticket is thrown away and a new one fetched.
 *
 * One is not enough — a single failure is more often a network blip than a bad
 * ticket, and a new ticket costs a round trip. Two is cheap and bounds the worst
 * case at one wasted retry.
 */
export const HANDSHAKE_FAILURES_BEFORE_REFRESH = 2;

function reconnectDelay(attempt: number): number {
  const index = Math.min(attempt, CHAT_RECONNECT_DELAYS_MS.length - 1);
  return CHAT_RECONNECT_DELAYS_MS[index];
}

export interface UseChatRoomOptions {
  /**
   * Session token of the logged-in member, or null when anonymous.
   *
   * Changing it re-mints the ticket and reconnects: the display name is decided
   * when the ticket is signed, so a login or logout has to reach the server to
   * take effect in the room.
   */
  authToken?: string | null;
}

export function useChatRoom(
  { authToken = null }: UseChatRoomOptions = {}
): ChatRoomController {
  const [status, setStatus] = useState<ChatConnectionStatus>(() =>
    isChatConfigured ? "gated" : "unavailable"
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState(0);
  const [handle, setHandle] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const ticketRef = useRef<ChatTicket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  /**
   * Timer that fires if a keepalive goes unanswered.
   *
   * Its existence is the "a ping is in flight" flag; clearing it is how a pong
   * is acknowledged. See CHAT_PONG_TIMEOUT_MS for why waiting for the reply is
   * the only way to notice a socket the OS killed while the phone slept.
   */
  const pongTimerRef = useRef<number | null>(null);
  /**
   * When a connection was last attempted.
   *
   * A phone fires visibilitychange constantly — every screen lock, every app
   * switch — and the focus recovery below would otherwise retry on each one.
   */
  const lastAttemptAtRef = useRef(0);
  /**
   * Consecutive attempts that closed without ever opening.
   *
   * A browser is told nothing about why a WebSocket handshake failed — no status
   * reaches JS — so a ticket the server refuses looks exactly like a flaky
   * network. Counting handshakes that never opened is the only signal available,
   * and past a couple of them the ticket is the likelier culprit.
   */
  const handshakeFailuresRef = useRef(0);
  /** Guards every async continuation against running after unmount. */
  const liveRef = useRef(true);
  const joiningRef = useRef(false);
  /**
   * The session the current ticket was minted with.
   *
   * Held in a ref so `join` does not have to be rebuilt when it changes, and
   * compared in the effect below to notice a login or logout.
   */
  const authTokenRef = useRef<string | null>(authToken);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (pongTimerRef.current !== null) {
      window.clearTimeout(pongTimerRef.current);
      pongTimerRef.current = null;
    }
  }, []);

  /**
   * Sends a keepalive and requires an answer.
   *
   * The socket is dropped on purpose when the deadline passes: closing it is
   * what produces the onclose the reconnect logic already knows how to handle.
   * Doing nothing instead leaves a socket that reports OPEN, accepts sends and
   * delivers nothing — the state a slept phone comes back in.
   */
  const pingAndExpectPong = useCallback((socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN) return;

    try {
      socket.send(CHAT_PING_FRAME);
    } catch {
      // Already gone; onclose will run and the reconnect follows from there.
      return;
    }

    // One deadline at a time: a second ping while one is pending keeps the
    // original clock rather than granting an extension.
    if (pongTimerRef.current !== null) return;

    pongTimerRef.current = window.setTimeout(() => {
      pongTimerRef.current = null;
      if (!liveRef.current) return;
      console.warn("[chat] keepalive unanswered; dropping the socket");
      try {
        socket.close();
      } catch {
        // Nothing to close means onclose has already run.
      }
    }, CHAT_PONG_TIMEOUT_MS);
  }, []);

  const handleServerFrame = useCallback((raw: string) => {
    // The keepalive reply is a bare word, not JSON — check before parsing so a
    // pong does not log as a protocol error. Clearing the deadline here is what
    // marks the connection as proven alive.
    if (raw === CHAT_PONG_FRAME) {
      if (pongTimerRef.current !== null) {
        window.clearTimeout(pongTimerRef.current);
        pongTimerRef.current = null;
      }
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[chat] dropped an unparseable frame");
      return;
    }
    if (typeof parsed !== "object" || parsed === null) return;

    const event = parsed as Record<string, unknown>;

    if (event["type"] === "hello") {
      // The server's backlog replaces the local view rather than merging into
      // it: after a reconnect the server is the only thing that knows what the
      // room actually contains now.
      const incoming = Array.isArray(event["messages"])
        ? event["messages"].filter(isChatMessage)
        : [];
      setMessages(incoming.slice(-CHAT_MESSAGE_CAP));
      if (typeof event["handle"] === "string") setHandle(event["handle"]);
      if (typeof event["participants"] === "number") {
        setParticipants(event["participants"]);
      }
      return;
    }

    if (event["type"] === "message" && isChatMessage(event["message"])) {
      const message = event["message"];
      setMessages((prev) =>
        prev.some((m) => m.id === message.id)
          ? prev
          : appendWithCap(prev, message, CHAT_MESSAGE_CAP)
      );
      return;
    }

    if (event["type"] === "presence" && typeof event["participants"] === "number") {
      setParticipants(event["participants"]);
      return;
    }

    if (event["type"] === "rejected" && typeof event["message"] === "string") {
      setNotice(event["message"]);
    }
  }, []);

  const connect = useCallback(
    (ticket: ChatTicket) => {
      if (!liveRef.current) return;

      const url = chatSocketUrl(ticket.ticket);
      if (!url) {
        setStatus("unavailable");
        return;
      }

      ticketRef.current = ticket;
      lastAttemptAtRef.current = Date.now();
      setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

      let opened = false;
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch (e) {
        console.warn("[chat] socket could not be created", e);
        setStatus("closed");
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        if (!liveRef.current) return;
        opened = true;
        attemptRef.current = 0;
        handshakeFailuresRef.current = 0;
        setStatus("open");
        setError(null);
        pingTimerRef.current = window.setInterval(() => {
          pingAndExpectPong(socket);
        }, CHAT_PING_INTERVAL_MS);
      };

      socket.onmessage = (event: MessageEvent<unknown>) => {
        if (!liveRef.current) return;
        if (typeof event.data === "string") handleServerFrame(event.data);
      };

      socket.onerror = () => {
        // onclose always follows, and it carries the information worth acting
        // on, so the reconnect decision is made there only.
        console.warn("[chat] socket error");
      };

      socket.onclose = () => {
        /*
         * A superseded socket says nothing about the current one.
         *
         * close() only requests the close — the event lands asynchronously, so
         * by the time a socket closed on purpose (session change, StrictMode
         * remount) gets here, socketRef may already hold its replacement.
         * Running the cleanup then nulled the NEW socket's ref, threw away the
         * freshly minted ticket and scheduled a duplicate reconnect. A shared
         * "closing" flag cannot express this — it was reset again before the
         * event arrived — so the guard is the socket's own identity: every
         * intentional close nulls socketRef first, and this handler acts only
         * for the socket the hook still considers current.
         */
        if (socketRef.current !== socket) return;
        if (pingTimerRef.current !== null) {
          window.clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        socketRef.current = null;
        if (!liveRef.current) return;

        // A socket that closed without opening never completed a handshake.
        if (socket.readyState !== WebSocket.OPEN && !opened) {
          handshakeFailuresRef.current += 1;
        }

        const held = ticketRef.current;
        /*
         * Unexpired is not the same as accepted.
         *
         * The ticket used to be signed over the caller's IP hash, so it stopped
         * verifying whenever a phone changed network and for everyone at UTC
         * midnight when the hash salt rotates — while still being well inside its
         * thirty minutes. This branch only asked about expiry, so the client
         * retried a ticket the server was refusing, forever, which is what left
         * phones in "재연결 중…" on re-entry. The binding is gone now; this guard
         * stays so any future refusal is survivable rather than terminal.
         */
        const refused =
          handshakeFailuresRef.current >= HANDSHAKE_FAILURES_BEFORE_REFRESH;
        const stillValid =
          held !== null && Date.parse(held.expiresAt) > Date.now() && !refused;

        if (!stillValid) {
          /*
           * The ticket outlived the session, so the socket cannot be retried
           * with it — fetch a fresh one and carry on.
           *
           * This used to park at "gated" and wait for the visitor to press a
           * join button. With the door removed there is no such button, so the
           * room simply died after the ticket's thirty minutes and only a reload
           * brought it back. Backed off on the same schedule as an ordinary
           * reconnect, so a failing ticket endpoint cannot become a hot loop.
           */
          clearCachedTicket();
          ticketRef.current = null;
          const rejoinDelay = reconnectDelay(attemptRef.current);
          attemptRef.current += 1;
          setStatus("reconnecting");
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            if (liveRef.current) joinRef.current("");
          }, rejoinDelay);
          return;
        }

        const delay = reconnectDelay(attemptRef.current);
        attemptRef.current += 1;
        setStatus("reconnecting");
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          if (liveRef.current && ticketRef.current) connect(ticketRef.current);
        }, delay);
      };
    },
    [handleServerFrame, pingAndExpectPong]
  );

  const join = useCallback(
    (turnstileToken: string) => {
      // Ref lock, not the isJoining state: a state dependency would rebuild this
      // callback mid-flight and let a second click through.
      if (!isChatConfigured || joiningRef.current) return;
      joiningRef.current = true;
      setIsJoining(true);
      setError(null);

      void requestChatTicket(turnstileToken, undefined, authTokenRef.current)
        .then((ticket) => {
          if (!liveRef.current) return;
          storeTicket(ticket);
          attemptRef.current = 0;
          handshakeFailuresRef.current = 0;
          connect(ticket);
        })
        .catch((e: unknown) => {
          if (!liveRef.current) return;
          setError(
            e instanceof ChatApiError
              ? e.message
              : "실시간 채팅에 입장할 수 없습니다. 잠시 후 다시 시도해주세요."
          );
          setStatus("gated");
        })
        .finally(() => {
          joiningRef.current = false;
          if (liveRef.current) setIsJoining(false);
        });
    },
    [connect]
  );

  /**
   * Latest join, readable from the mount effect without listing it as a
   * dependency — a dependency would tear the socket down and rebuild it every
   * time the callback is recreated.
   */
  const joinRef = useRef(join);
  joinRef.current = join;

  const send = useCallback((body: string): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    setNotice(null);
    socket.send(JSON.stringify({ type: "message", body }));
    return true;
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  // Reconnect on mount with a cached ticket so a returning tab skips the door.
  useEffect(() => {
    liveRef.current = true;

    if (!isChatConfigured) {
      setStatus("unavailable");
      return;
    }

    // No door any more: the entry CAPTCHA was removed, so a visitor should never
    // see a "join" step. A cached ticket connects straight away; otherwise one is
    // fetched and used immediately. join() stays exported for a retry after a
    // failure, and its ref lock keeps this call from racing that one.
    const cached = loadCachedTicket();
    if (cached) {
      connect(cached);
    } else {
      joinRef.current("");
    }

    /*
     * Recover the moment the tab comes back.
     *
     * This is the ordinary reason a reader sees the room drop and return. A
     * hidden tab has its timers throttled — mobile browsers stretch a 45s
     * interval well past a minute or stop it altogether — so the keepalive stops
     * firing and the connection is closed as idle. Waiting out the backoff after
     * that means staring at "재연결 중…" for no reason, so a visible tab retries
     * at once and from a clean attempt count.
     *
     * A live socket is left alone: an unnecessary reconnect would cost the
     * backlog round trip for nothing.
     */
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!liveRef.current) return;

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        /*
         * Prod the socket AND wait for the answer.
         *
         * This branch used to send a ping and return, treating an OPEN
         * readyState as proof of life. It is not: a phone coming back from sleep
         * holds a half-open connection that reports OPEN and swallows sends
         * silently, so the room sat there looking connected and receiving
         * nothing until the kernel timed the socket out minutes later.
         */
        pingAndExpectPong(socket);
        return;
      }
      if (socket && socket.readyState === WebSocket.CONNECTING) return;

      /*
       * Two guards, both learned the hard way.
       *
       * The attempt counter is no longer reset here. Resetting it meant a phone
       * flipping visibility never let the backoff grow, so a connection that
       * kept being refused was retried at full speed indefinitely — the
       * repeating "재연결 중…". The counter now only resets on a successful open,
       * which is the only event that proves the retry worked.
       *
       * And a minimum gap since the last attempt, so a burst of visibility
       * events cannot become a burst of sockets. The already-scheduled reconnect
       * is left to fire on its own in that case.
       */
      if (Date.now() - lastAttemptAtRef.current < VISIBILITY_RETRY_MIN_GAP_MS) {
        return;
      }

      clearTimers();
      const held = ticketRef.current;
      if (held !== null && Date.parse(held.expiresAt) > Date.now()) {
        connect(held);
      } else {
        joinRef.current("");
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      liveRef.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearTimers();
      // Nulling the ref before close() is what makes the close intentional:
      // when the close event arrives, onclose finds itself superseded and
      // does nothing (see connect).
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) socket.close(1000, "leaving room");
    };
  }, [connect, clearTimers, pingAndExpectPong]);

  /*
   * A login or logout changes who the room should show, and that is decided by
   * the server when the ticket is signed. So the held ticket is discarded and a
   * fresh one minted; the socket goes down and comes back under the new name.
   *
   * Skipped on the first run: the initial ticket is already being fetched with
   * whatever session was present at mount.
   */
  const firstAuthRunRef = useRef(true);
  useEffect(() => {
    if (firstAuthRunRef.current) {
      firstAuthRunRef.current = false;
      authTokenRef.current = authToken;
      return;
    }
    if (authTokenRef.current === authToken) return;

    authTokenRef.current = authToken;
    clearCachedTicket();
    ticketRef.current = null;
    // A pending reconnect or keepalive belongs to the old session's socket.
    clearTimers();

    /*
     * Null the ref before close(). The close event fires asynchronously —
     * after the fresh ticket is minted and the new socket built — so the old
     * socket's onclose must find itself superseded rather than run the
     * reconnect cleanup against its replacement (see connect for the guard).
     * The shared flag this used to flip was already reset by then, which is
     * exactly how the old close nulled the new socket and cleared the new
     * ticket.
     */
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) socket.close(1000, "session changed");
    joinRef.current("");
  }, [authToken, clearTimers]);

  return {
    status,
    messages,
    participants,
    handle,
    notice,
    error,
    isJoining,
    join,
    send,
    clearNotice,
  };
}
