/**
 * Chat room tunables.
 *
 * Kept in one platform-free module because the browser and the Worker must
 * agree on them: the composer counts characters against the same limit the
 * server enforces, and the room capacity the server evicts against is the
 * same number the UI explains to the reader.
 */

/** Rolling window of retained messages. The oldest are evicted past this. */
export const CHAT_MESSAGE_CAP = 500;

/**
 * Chat lines are short. Capped well below the board's 1,000 characters so one
 * participant cannot flood the shared 500-message window with a single paste.
 */
export const CHAT_MESSAGE_MAX_LENGTH = 300;

/** How much backlog a joining reader receives. Not the retention limit. */
export const CHAT_HISTORY_LIMIT = 50;

/** Minimum gap between two accepted messages from the same IP hash. */
export const CHAT_SEND_MIN_INTERVAL_MS = 2_000;

/** Sliding window used for the burst limit below. */
export const CHAT_RATE_WINDOW_MS = 60_000;

/** Messages allowed per IP hash inside CHAT_RATE_WINDOW_MS. */
export const CHAT_RATE_WINDOW_MAX = 15;

/**
 * A single global room. Named rather than random so every visitor resolves to
 * the same Durable Object instance, which is what makes presence meaningful.
 */
export const CHAT_ROOM_NAME = "kospinow-main";

/** Join ticket lifetime. One CAPTCHA covers reconnects inside this window. */
export const CHAT_TICKET_TTL_MS = 30 * 60 * 1_000;

/**
 * Reconnect backoff from CLAUDE.md §14, reused so the chat socket behaves like
 * the quote socket: quick first retry, then back off, never faster than 30 s.
 */
export const CHAT_RECONNECT_DELAYS_MS = [
  1_000, 2_000, 4_000, 8_000, 15_000, 30_000,
] as const;

/**
 * Application-level keepalive. The Durable Object answers these from its
 * auto-response table without waking, so an idle room stays hibernated.
 */
export const CHAT_PING_INTERVAL_MS = 45_000;
export const CHAT_PING_FRAME = "ping";
export const CHAT_PONG_FRAME = "pong";

/** Header the Worker uses to hand the server-derived identity to the room. */
export const CHAT_IP_HASH_HEADER = "X-Chat-Ip-Hash";
