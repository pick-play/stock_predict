import { errorResponse, jsonResponse } from '../lib/cors';
import { hashIp } from '../lib/ipHash';
import { issueChatTicket, verifyChatTicket } from '../lib/chatTicket';
import { getChatRoomNamespace } from '../chatEnv';
import { isAdmin } from '../lib/adminAuth';
import { requireAuth } from '../lib/session';
import {
  CHAT_ADMIN_DELETE_PATH,
  CHAT_HISTORY_PATH,
  CHAT_PRESENCE_PATH,
  CHAT_IP_HASH_HEADER,
  CHAT_MEMBER_HANDLE_HEADER,
  CHAT_PREVIEW_TTL_MS,
  CHAT_ROOM_NAME,
  CHAT_TICKET_TTL_MS,
} from '../../../src/lib/chat/config';
import type { Env } from '../types';

function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    '0.0.0.0'
  );
}

/**
 * Browsers do not apply CORS to WebSocket handshakes — no preflight, and the
 * connection opens whatever the response headers say. The Origin allowlist that
 * cors.ts enforces for the board therefore has to be re-checked by hand here,
 * or any page on the internet could open a socket into the room.
 */
function isAllowedChatOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return allowed.includes(origin) || origin === 'http://localhost:5173';
}

function unavailable(request: Request, env: Env): Response {
  return errorResponse(
    'chat-unavailable',
    '채팅방을 준비 중입니다.',
    503,
    request,
    env
  );
}

// ─── POST /api/chat/ticket ─────────────────────────────────────────────────

/**
 * Issues a short-lived join ticket.
 *
 * There is no CAPTCHA at the door any more: it was removed by owner decision
 * because the challenge cost seconds on a phone before a reader could type
 * anything. The ticket survives it as the connection credential — it binds a
 * socket to an IP hash and is verified before the Durable Object is touched, so
 * a probe costs a Worker request rather than waking the room.
 *
 * What this costs: the room no longer has anything that forces a real browser.
 * The remaining defences are the per-IP-hash send limit, the moderation filter,
 * and a per-IP-hash cap on concurrent sockets in the room itself. All three are
 * now load-bearing; removing any one leaves the room open to a script.
 */
export async function handleChatTicket(
  request: Request,
  env: Env
): Promise<Response> {
  if (!getChatRoomNamespace(env)) return unavailable(request, env);

  // The body is ignored. Kept accepting POST so an older cached bundle asking
  // for a ticket the previous way still gets one instead of a hard failure.
  //
  // No IP is read here: the ticket is no longer bound to one. The room still
  // gets its identity from the hash the Worker computes on the socket request,
  // which is the only place it has ever mattered.
  //
  // A bearer token, if one came with the request, is where a fixed nickname
  // comes from. This is the only moment the session is examined: the name is
  // then signed into the ticket, so the socket handshake needs no credential of
  // its own and no name ever arrives as a client claim.
  const user = await requireAuth(request, env);

  const expiresAt = Date.now() + CHAT_TICKET_TTL_MS;
  const ticket = await issueChatTicket(env.IP_SALT, expiresAt, user?.nickname);

  return jsonResponse(
    {
      ticket,
      expiresAt: new Date(expiresAt).toISOString(),
      // Echoed so the client can say who it will appear as before it connects.
      handle: user?.nickname ?? null,
    },
    200,
    request,
    env
  );
}

// ─── GET /api/chat/room (WebSocket) ────────────────────────────────────────

/**
 * Upgrades to a socket on the room's Durable Object.
 *
 * Every check runs here, in the Worker, before the object is touched: an
 * unverified probe should cost a Worker request, not a Durable Object request.
 */
export async function handleChatRoom(
  request: Request,
  env: Env
): Promise<Response> {
  const namespace = getChatRoomNamespace(env);
  if (!namespace) return unavailable(request, env);

  if ((request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') {
    return errorResponse(
      'expected-websocket',
      '웹소켓 연결이 필요합니다.',
      426,
      request,
      env
    );
  }

  if (!isAllowedChatOrigin(request, env)) {
    return errorResponse(
      'forbidden-origin',
      '허용되지 않은 접속 경로입니다.',
      403,
      request,
      env
    );
  }

  const ticket = new URL(request.url).searchParams.get('ticket') ?? '';
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  const verified = await verifyChatTicket(ticket, env.IP_SALT, Date.now());
  if (!verified) {
    return errorResponse(
      'invalid-ticket',
      '입장 확인이 만료되었습니다. 다시 입장해주세요.',
      403,
      request,
      env
    );
  }

  /*
   * The room takes its identity from these headers alone, so the client never
   * gets to state who it is. Both are stripped-and-set here rather than
   * forwarded: a client that sent its own copy must not have it survive.
   */
  const headers = new Headers(request.headers);
  headers.set(CHAT_IP_HASH_HEADER, ipHash);
  headers.delete(CHAT_MEMBER_HANDLE_HEADER);
  if (verified.handle) {
    headers.set(CHAT_MEMBER_HANDLE_HEADER, encodeURIComponent(verified.handle));
  }

  const stub = namespace.get(namespace.idFromName(CHAT_ROOM_NAME));
  return stub.fetch(request.url, { method: request.method, headers });
}

// ─── GET /api/chat/recent (read-only preview) ──────────────────────────────

/**
 * Cached preview payload, shared by every dashboard reader.
 *
 * Held in module scope rather than proxied straight through: without it each
 * dashboard view would wake the room, which defeats hibernation. The object is
 * only cheap while asleep, and a read-only strip has no business being the
 * thing that keeps it up.
 */
let previewCache: { payload: unknown; storedAtMs: number } | null = null;

/**
 * The last few lines and the current head count, for the strip on the dashboard.
 *
 * No ticket and no captcha — the room is public to read, matching the board.
 */
/**
 * Records that somebody is on the site, and answers with how many are.
 *
 * Called once a minute by every visible tab, from every page — which is why it
 * does as little as possible: hash the address, hand it to the room, return a
 * number. No ticket, no session, no body.
 *
 * It does wake the room, unlike the cached preview beside it. That is the cost
 * of the feature and it was taken knowingly: hibernation still holds overnight,
 * when nobody is on the site to ping.
 */
export async function handleChatPresence(
  request: Request,
  env: Env
): Promise<Response> {
  const namespace = getChatRoomNamespace(env);
  if (!namespace) return unavailable(request, env);

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const ipHash = await hashIp(ip, env.IP_SALT);

  const headers = new Headers();
  headers.set(CHAT_IP_HASH_HEADER, ipHash);

  const stub = namespace.get(namespace.idFromName(CHAT_ROOM_NAME));
  try {
    const upstream = await stub.fetch(
      `https://chat-room.internal${CHAT_PRESENCE_PATH}`,
      { headers }
    );
    if (!upstream.ok) throw new Error(`room responded ${upstream.status}`);
    return jsonResponse(await upstream.json(), 200, request, env);
  } catch (error) {
    console.warn('[chat] presence ping failed', error);
    // A count nobody can read is not worth an error state on the page.
    return jsonResponse({ participants: 0 }, 200, request, env);
  }
}

export async function handleChatRecent(
  request: Request,
  env: Env
): Promise<Response> {
  const namespace = getChatRoomNamespace(env);
  if (!namespace) return unavailable(request, env);

  /*
   * Moderators read a longer, uncached window: they are acting on what is in the
   * room right now, and a ten-second-old copy is how you delete the wrong line.
   * Everyone else gets the cached strip, which is what keeps the room asleep.
   */
  const url = new URL(request.url);
  const askedLimit = url.searchParams.get('limit');
  if (askedLimit !== null && isAdmin(request, env)) {
    return chatHistory(request, env, namespace, askedLimit);
  }

  /*
   * "…and while you are answering, I am here."
   *
   * The dashboard polls this anyway, so presence rides along instead of costing
   * a request of its own — 60 per visitor-hour saved against a budget that is
   * shared by every endpoint the site has, and that a dedicated poll exhausted
   * once already. The room still sees one announcement per visitor per minute:
   * the client only sets the flag when one is due.
   */
  let freshCount: number | null = null;
  if (url.searchParams.get('presence') === '1') {
    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const ipHash = await hashIp(ip, env.IP_SALT);
    const headers = new Headers();
    headers.set(CHAT_IP_HASH_HEADER, ipHash);
    try {
      const stub = namespace.get(namespace.idFromName(CHAT_ROOM_NAME));
      const res = await stub.fetch(
        `https://chat-room.internal${CHAT_PRESENCE_PATH}`,
        { headers }
      );
      if (res.ok) {
        const payload = (await res.json()) as { participants?: unknown };
        if (typeof payload.participants === 'number') {
          freshCount = payload.participants;
        }
      }
    } catch (error) {
      // Missing one announcement costs this visitor a minute of being counted.
      console.warn('[chat] presence on preview failed', error);
    }
  }

  /** The cached lines, with the count replaced when we just read a fresh one. */
  const withCount = (payload: unknown): unknown =>
    freshCount === null
      ? payload
      : { ...(payload as Record<string, unknown>), participants: freshCount };

  const cachedAge = previewCache ? Date.now() - previewCache.storedAtMs : -1;
  if (previewCache && cachedAge >= 0 && cachedAge < CHAT_PREVIEW_TTL_MS) {
    return jsonResponse(withCount(previewCache.payload), 200, request, env);
  }

  const stub = namespace.get(namespace.idFromName(CHAT_ROOM_NAME));

  try {
    const upstream = await stub.fetch(
      `https://chat-room.internal${CHAT_HISTORY_PATH}`
    );
    if (!upstream.ok) {
      throw new Error(`room responded ${upstream.status}`);
    }
    const payload: unknown = await upstream.json();
    previewCache = { payload, storedAtMs: Date.now() };
    return jsonResponse(withCount(payload), 200, request, env);
  } catch (error) {
    console.warn('[chat] preview read failed', error);
    // A stale preview beats an empty strip, and every line carries its own
    // timestamp, so a reader can still see how old the conversation is.
    if (previewCache) {
      return jsonResponse(withCount(previewCache.payload), 200, request, env);
    }
    return errorResponse(
      'room-unavailable',
      '채팅 미리보기를 불러올 수 없습니다.',
      503,
      request,
      env
    );
  }
}

/**
 * Deletes chat lines. Moderator only.
 *
 * Body is either `{ ids: string[] }` for single lines or `{ handle: string }`
 * to clear everything one sender still has in the window. The room broadcasts
 * the removal, so open screens drop the line without a reload.
 *
 * The preview cache is cleared on success. Otherwise the dashboard strip would
 * keep serving a deleted line for the rest of its TTL — the one place a removed
 * message could outlive the room.
 */
export async function handleChatAdminDelete(
  request: Request,
  env: Env
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }

  const namespace = getChatRoomNamespace(env);
  if (!namespace) return unavailable(request, env);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  const stub = namespace.get(namespace.idFromName(CHAT_ROOM_NAME));

  try {
    const upstream = await stub.fetch(
      `https://chat-room.internal${CHAT_ADMIN_DELETE_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!upstream.ok) {
      return errorResponse(
        'invalid',
        '삭제할 대상을 찾을 수 없습니다.',
        upstream.status === 400 ? 400 : 502,
        request,
        env
      );
    }

    const payload = (await upstream.json()) as { deleted?: unknown };
    previewCache = null;

    const deleted = Array.isArray(payload.deleted) ? payload.deleted : [];
    return jsonResponse({ deleted }, 200, request, env);
  } catch (error) {
    console.warn('[chat] admin delete failed', error);
    return errorResponse(
      'room-unavailable',
      '채팅방에 연결할 수 없습니다.',
      503,
      request,
      env
    );
  }
}

/** Uncached transcript read, used only by the moderator console. */
async function chatHistory(
  request: Request,
  env: Env,
  namespace: DurableObjectNamespace,
  limit: string
): Promise<Response> {
  const stub = namespace.get(namespace.idFromName(CHAT_ROOM_NAME));
  try {
    const upstream = await stub.fetch(
      `https://chat-room.internal${CHAT_HISTORY_PATH}?limit=${encodeURIComponent(limit)}`
    );
    if (!upstream.ok) throw new Error(`room responded ${upstream.status}`);
    return jsonResponse(await upstream.json(), 200, request, env);
  } catch (error) {
    console.warn('[chat] admin history read failed', error);
    return errorResponse(
      'room-unavailable',
      '채팅 내역을 불러올 수 없습니다.',
      503,
      request,
      env
    );
  }
}
