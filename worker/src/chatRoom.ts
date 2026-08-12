/**
 * ChatRoom — one Durable Object instance is one chat room.
 *
 * Why a Durable Object rather than the D1 database the board uses: real-time
 * delivery and a live participant count both need shared connection state, and
 * D1 has neither sockets nor presence. A single named instance owns the socket
 * set, so "how many people are here" is just the size of that set, and it owns
 * the 500-message window, so the cap is enforced in one place with no locking.
 *
 * The WebSocket Hibernation API is used throughout: the room is evicted from
 * memory while idle and only billed for the time it is actually handling a
 * message. That is also why per-socket identity lives on the socket attachment
 * instead of an instance field — instance memory does not survive hibernation.
 */

import {
  CHAT_ADMIN_DELETE_PATH,
  CHAT_HISTORY_PATH,
  CHAT_IP_HASH_HEADER,
  CHAT_PING_FRAME,
  CHAT_PONG_FRAME,
  CHAT_MESSAGE_CAP,
  CHAT_PREVIEW_LIMIT,
} from '../../src/lib/chat/config';
import { ChatMessageStore } from '../../src/lib/chat/messageStore';
import type {
  ChatStorage,
  ChatStorageListOptions,
} from '../../src/lib/chat/messageStore';
import {
  chatHandleFromIpHash,
  evaluateChatRate,
  isAtSocketLimit,
  parseChatClientEvent,
  validateChatMessage,
} from '../../src/lib/chat/rules';
import type { ChatRejectCode, ChatServerEvent } from '../../src/types/chat';

interface SocketIdentity {
  ipHash: string;
  handle: string;
}

/** Narrows the untyped socket attachment back into an identity. */
function readIdentity(socket: WebSocket): SocketIdentity | null {
  const raw: unknown = socket.deserializeAttachment();
  if (typeof raw !== 'object' || raw === null) return null;

  const candidate = raw as Record<string, unknown>;
  const { ipHash, handle } = candidate;
  if (typeof ipHash !== 'string' || typeof handle !== 'string') return null;

  return { ipHash, handle };
}

/**
 * WebSocket.CLOSING and WebSocket.CLOSED as numbers.
 *
 * Compared numerically rather than through the constants so a socket the runtime
 * hands back without them still classifies correctly — and erring toward
 * "counts as live" would bring back the reconnect loop.
 */
const READY_STATE_CLOSING = 2;
const READY_STATE_CLOSED = 3;

function isClosingOrClosed(socket: WebSocket): boolean {
  const state = socket.readyState;
  return state === READY_STATE_CLOSING || state === READY_STATE_CLOSED;
}

/**
 * 1005 and 1006 are reserved codes a peer may never send back, and anything
 * outside the valid range is refused by the runtime, so both collapse to 1000.
 */
function echoableCloseCode(code: number): number {
  if (code === 1005 || code === 1006) return 1000;
  return code >= 1000 && code <= 4999 ? code : 1000;
}

export class ChatRoom implements DurableObject {
  private readonly ctx: DurableObjectState;
  private readonly store: ChatMessageStore;

  /**
   * Accepted send times per IP hash.
   *
   * Intentionally in memory: hibernation clears it, but a room only hibernates
   * after it has gone quiet, so a cleared limiter can only ever follow a period
   * with no traffic to limit. Persisting it would add a storage write to every
   * single message for no abuse benefit.
   */
  private readonly sendHistory: Map<string, number[]>;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
    this.sendHistory = new Map<string, number[]>();
    this.store = new ChatMessageStore(this.createStorageAdapter(ctx));

    // Keepalives are answered from the auto-response table without waking the
    // room, which is what lets an idle room stay hibernated all night.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(CHAT_PING_FRAME, CHAT_PONG_FRAME)
    );
  }

  async fetch(request: Request): Promise<Response> {
    // Read-only transcript for the dashboard preview. Kept on the same object
    // because it is the only holder of the window, but it opens no socket and
    // takes no identity — nothing here can write.
    if (new URL(request.url).pathname === CHAT_HISTORY_PATH) {
      if (request.method !== 'GET') {
        return new Response('method not allowed', { status: 405 });
      }
      // A moderator needs more than the strip's few lines to find what to
      // delete. The Worker decides who may ask for more; the room only clamps.
      const asked = Number(
        new URL(request.url).searchParams.get('limit') ?? CHAT_PREVIEW_LIMIT
      );
      const limit = Number.isFinite(asked)
        ? Math.max(1, Math.min(Math.trunc(asked), CHAT_MESSAGE_CAP))
        : CHAT_PREVIEW_LIMIT;
      const messages = await this.store.history(limit);
      return new Response(
        JSON.stringify({ messages, participants: this.participantCount() }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Moderator deletion. Authorised by the Worker before it gets here — the
    // namespace has no route from the public internet — so the room's job is to
    // remove the rows and make sure no screen keeps showing them.
    if (new URL(request.url).pathname === CHAT_ADMIN_DELETE_PATH) {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }
      return this.handleAdminDelete(request);
    }

    if ((request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') {
      return new Response('expected websocket upgrade', { status: 426 });
    }

    // Only the Worker can set this header, and it only does so after the join
    // ticket verifies. Its absence means the request bypassed that path.
    const ipHash = request.headers.get(CHAT_IP_HASH_HEADER) ?? '';
    if (ipHash === '') {
      return new Response('missing identity', { status: 400 });
    }

    // Replaces the entry CAPTCHA that used to force a real browser. Nothing else
    // stops a script from holding sockets open now: the send limiter would keep
    // it quiet, but the head count and the room's wakefulness are still its to
    // abuse. Counted from the attachments, because instance memory does not
    // survive hibernation.
    if (isAtSocketLimit(this.socketsForIpHash(ipHash))) {
      return new Response('too many connections', { status: 429 });
    }

    const handle = chatHandleFromIpHash(ipHash);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const identity: SocketIdentity = { ipHash, handle };
    server.serializeAttachment(identity);
    this.ctx.acceptWebSocket(server);

    const messages = await this.store.history();
    this.send(server, {
      type: 'hello',
      handle,
      participants: this.participantCount(),
      messages,
    });

    // The joiner already learned the count from `hello`; everyone else needs it.
    this.broadcast(
      { type: 'presence', participants: this.participantCount() },
      server
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // The protocol is JSON text; binary frames are not part of it.
    if (typeof message !== 'string') return;
    // Normally intercepted by the auto-response table, but a keepalive that
    // arrives while the table is being reset must not read as a chat frame.
    if (message === CHAT_PING_FRAME) return;

    const identity = readIdentity(socket);
    if (!identity) {
      socket.close(1011, 'identity unavailable');
      return;
    }

    const event = parseChatClientEvent(message);
    if (!event) {
      this.reject(socket, 'invalid', '알 수 없는 요청입니다.');
      return;
    }

    // Rate limiting runs before the content rules and consumes a slot either
    // way. If rejected text were free, the moderation filter itself would
    // become an unlimited channel to hammer.
    const now = Date.now();
    const verdict = evaluateChatRate(
      this.sendHistory.get(identity.ipHash) ?? [],
      now
    );
    this.sendHistory.set(identity.ipHash, verdict.history);

    if (!verdict.allowed) {
      const seconds = Math.max(1, Math.ceil(verdict.retryAfterMs / 1_000));
      this.reject(
        socket,
        'rate-limited',
        `너무 빠르게 보내고 있습니다. ${seconds}초 후 다시 보내주세요.`
      );
      return;
    }

    const validation = validateChatMessage(event.body);
    if (!validation.ok || validation.body === undefined) {
      this.reject(
        socket,
        validation.code ?? 'invalid',
        validation.message ?? '보낼 수 없는 내용입니다.'
      );
      return;
    }

    // The handle comes from the socket attachment, never from the frame, so a
    // sender cannot claim someone else's name.
    const stored = await this.store.append({
      body: validation.body,
      handle: identity.handle,
      createdAt: new Date(now).toISOString(),
    });

    this.broadcast({ type: 'message', message: stored });
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string
  ): Promise<void> {
    // This Worker's compatibility_date predates the runtime's automatic close
    // reply, so without echoing the code back the peer reports a 1006 abnormal
    // closure even on a clean goodbye.
    try {
      socket.close(echoableCloseCode(code), reason);
    } catch (error) {
      console.warn('[chat] close echo failed', error);
    }

    this.broadcast(
      { type: 'presence', participants: this.participantCount(socket) },
      socket
    );
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    console.warn('[chat] socket error', error);
    this.broadcast(
      { type: 'presence', participants: this.participantCount(socket) },
      socket
    );
  }

  /**
   * How many *live* sockets this IP hash already holds.
   *
   * The readyState filter is the whole point. A phone that switches network or
   * locks its screen drops a connection without a close frame, and the runtime
   * keeps the dead socket in the set until it notices. Counting those made the
   * tally climb with every reconnect until it hit the cap, at which point the
   * upgrade was refused — and a refused upgrade looks to the browser exactly
   * like a failed connection, so it reconnected, was refused again, and sat in
   * "재연결 중…" forever. Mobile hit it fastest because mobile drops most.
   */
  private socketsForIpHash(ipHash: string): number {
    let count = 0;
    for (const socket of this.ctx.getWebSockets()) {
      if (isClosingOrClosed(socket)) continue;
      if (readIdentity(socket)?.ipHash === ipHash) count++;
    }
    return count;
  }

  /**
   * Live participant count.
   *
   * getWebSockets() can still return a socket that is closing, so the one being
   * torn down is excluded explicitly rather than trusted to have left the set —
   * and so is any other socket already closing or closed, which is how a phone
   * that dropped without a close frame used to keep inflating the count.
   */
  private participantCount(exclude?: WebSocket): number {
    return this.ctx
      .getWebSockets()
      .filter((socket) => socket !== exclude && !isClosingOrClosed(socket))
      .length;
  }

  /**
   * Removes lines by id, or every retained line from one handle.
   *
   * The broadcast goes to every socket with no exclusion: a moderator watching
   * from the room has to see the line disappear too, and there is no sender to
   * spare here.
   */
  private async handleAdminDelete(request: Request): Promise<Response> {
    let ids: string[] = [];
    let handle = '';

    try {
      const body = (await request.json()) as {
        ids?: unknown;
        handle?: unknown;
      };
      if (Array.isArray(body.ids)) {
        ids = body.ids.filter((id): id is string => typeof id === 'string');
      }
      if (typeof body.handle === 'string') handle = body.handle;
    } catch {
      return new Response('invalid body', { status: 400 });
    }

    if (ids.length === 0 && handle === '') {
      return new Response('nothing to delete', { status: 400 });
    }

    const deleted = handle
      ? await this.store.removeByHandle(handle)
      : await this.store.remove(ids);

    if (deleted.length > 0) {
      this.broadcast({ type: 'deleted', ids: deleted });
    }

    return new Response(JSON.stringify({ deleted }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  private send(socket: WebSocket, event: ChatServerEvent): void {
    try {
      socket.send(JSON.stringify(event));
    } catch (error) {
      console.warn('[chat] send failed', error);
    }
  }

  private broadcast(event: ChatServerEvent, exclude?: WebSocket): void {
    const payload = JSON.stringify(event);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude) continue;
      try {
        socket.send(payload);
      } catch (error) {
        // A socket can die between getWebSockets() and send(); losing one
        // delivery must not abort the fan-out to everyone else.
        console.warn('[chat] broadcast failed', error);
      }
    }
  }

  private reject(
    socket: WebSocket,
    code: ChatRejectCode,
    message: string
  ): void {
    this.send(socket, { type: 'rejected', code, message });
  }

  /**
   * Bridges Durable Object storage to the platform-free interface the store
   * expects. Written out by hand so the store never sees a Cloudflare type.
   */
  private createStorageAdapter(ctx: DurableObjectState): ChatStorage {
    const storage = ctx.storage;
    return {
      get: (key: string) => storage.get(key),
      put: (entries: Record<string, unknown>) => storage.put(entries),
      delete: (keys: string[]) => storage.delete(keys),
      list: (options: ChatStorageListOptions) => storage.list(options),
    };
  }
}
