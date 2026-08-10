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

function reconnectDelay(attempt: number): number {
  const index = Math.min(attempt, CHAT_RECONNECT_DELAYS_MS.length - 1);
  return CHAT_RECONNECT_DELAYS_MS[index];
}

export function useChatRoom(): ChatRoomController {
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
  /** Guards every async continuation against running after unmount. */
  const liveRef = useRef(true);
  /** Set while tearing down on purpose, so cleanup does not reconnect. */
  const closingRef = useRef(false);
  const joiningRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const handleServerFrame = useCallback((raw: string) => {
    // The keepalive reply is a bare word, not JSON — check before parsing so a
    // pong does not log as a protocol error.
    if (raw === CHAT_PONG_FRAME) return;

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
      setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

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
        attemptRef.current = 0;
        setStatus("open");
        setError(null);
        pingTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(CHAT_PING_FRAME);
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
        if (pingTimerRef.current !== null) {
          window.clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        socketRef.current = null;
        if (!liveRef.current || closingRef.current) return;

        const held = ticketRef.current;
        const stillValid =
          held !== null && Date.parse(held.expiresAt) > Date.now();

        if (!stillValid) {
          // An expired ticket cannot be retried; the visitor has to clear the
          // door check again.
          clearCachedTicket();
          ticketRef.current = null;
          attemptRef.current = 0;
          setStatus("gated");
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
    [handleServerFrame]
  );

  const join = useCallback(
    (turnstileToken: string) => {
      // Ref lock, not the isJoining state: a state dependency would rebuild this
      // callback mid-flight and let a second click through.
      if (!isChatConfigured || joiningRef.current) return;
      joiningRef.current = true;
      setIsJoining(true);
      setError(null);

      void requestChatTicket(turnstileToken)
        .then((ticket) => {
          if (!liveRef.current) return;
          storeTicket(ticket);
          attemptRef.current = 0;
          connect(ticket);
        })
        .catch((e: unknown) => {
          if (!liveRef.current) return;
          setError(
            e instanceof ChatApiError
              ? e.message
              : "채팅방에 입장할 수 없습니다. 잠시 후 다시 시도해주세요."
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
    closingRef.current = false;

    if (!isChatConfigured) {
      setStatus("unavailable");
      return;
    }

    const cached = loadCachedTicket();
    if (cached) connect(cached);

    return () => {
      liveRef.current = false;
      closingRef.current = true;
      clearTimers();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) socket.close(1000, "leaving room");
    };
  }, [connect, clearTimers]);

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
