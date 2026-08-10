import { errorResponse, jsonResponse } from '../lib/cors';
import { hashIp } from '../lib/ipHash';
import { verifyTurnstile } from '../lib/turnstile';
import { issueChatTicket, verifyChatTicket } from '../lib/chatTicket';
import { getChatRoomNamespace } from '../chatEnv';
import {
  CHAT_HISTORY_PATH,
  CHAT_IP_HASH_HEADER,
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

interface TicketBody {
  turnstileToken?: unknown;
}

/**
 * Trades a Turnstile token for a short-lived join ticket.
 *
 * Turnstile is required here rather than on every message because the room is
 * login-free: without a challenge at the door, per-IP rate limiting is the only
 * defence and a botnet defeats it by definition. One challenge per ticket
 * lifetime is the smallest amount of friction that still forces a real browser.
 */
export async function handleChatTicket(
  request: Request,
  env: Env
): Promise<Response> {
  if (!getChatRoomNamespace(env)) return unavailable(request, env);

  let parsed: TicketBody;
  try {
    parsed = (await request.json()) as TicketBody;
  } catch {
    return errorResponse(
      'invalid-body',
      '요청 형식이 올바르지 않습니다.',
      400,
      request,
      env
    );
  }

  const token =
    typeof parsed.turnstileToken === 'string' ? parsed.turnstileToken : '';
  const ip = getClientIp(request);

  const captchaOk = await verifyTurnstile(token, env.TURNSTILE_SECRET, ip);
  if (!captchaOk) {
    return errorResponse(
      'captcha-failed',
      'CAPTCHA 검증에 실패했습니다. 다시 시도해주세요.',
      403,
      request,
      env
    );
  }

  const ipHash = await hashIp(ip, env.IP_SALT);
  const expiresAt = Date.now() + CHAT_TICKET_TTL_MS;
  const ticket = await issueChatTicket(ipHash, env.IP_SALT, expiresAt);

  return jsonResponse(
    { ticket, expiresAt: new Date(expiresAt).toISOString() },
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

  if (!(await verifyChatTicket(ticket, ipHash, env.IP_SALT, Date.now()))) {
    return errorResponse(
      'invalid-ticket',
      '입장 확인이 만료되었습니다. 다시 입장해주세요.',
      403,
      request,
      env
    );
  }

  // The room derives the display handle from this header alone, so the client
  // never gets to state who it is.
  const headers = new Headers(request.headers);
  headers.set(CHAT_IP_HASH_HEADER, ipHash);

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
export async function handleChatRecent(
  request: Request,
  env: Env
): Promise<Response> {
  const namespace = getChatRoomNamespace(env);
  if (!namespace) return unavailable(request, env);

  const cachedAge = previewCache ? Date.now() - previewCache.storedAtMs : -1;
  if (previewCache && cachedAge >= 0 && cachedAge < CHAT_PREVIEW_TTL_MS) {
    return jsonResponse(previewCache.payload, 200, request, env);
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
    return jsonResponse(payload, 200, request, env);
  } catch (error) {
    console.warn('[chat] preview read failed', error);
    // A stale preview beats an empty strip, and every line carries its own
    // timestamp, so a reader can still see how old the conversation is.
    if (previewCache) {
      return jsonResponse(previewCache.payload, 200, request, env);
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
