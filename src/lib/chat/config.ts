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

/**
 * Concurrent sockets one IP hash may hold in the room.
 *
 * This is the control that replaced the entry CAPTCHA. Its job is resource
 * exhaustion, not spam — the send limiter handles spam — so it only has to stop
 * a script holding sockets open to inflate the head count and keep the room
 * awake.
 *
 * It was 3, which was wrong the moment more than three people shared an address.
 * One office, one café, one school, or one mobile carrier behind CGNAT all
 * present a single public IP, so the fourth real person was refused with a 429
 * and had no way to tell why. Sized instead for a plausible group on one
 * network; a script bounded at this many sockets is still bounded, because the
 * per-IP send limit caps what those sockets can actually say.
 */
export const CHAT_MAX_SOCKETS_PER_IP = 25;

/**
 * Path the Worker calls on the room stub to read the transcript over plain HTTP.
 *
 * The dashboard shows the latest few lines without joining, and a socket per
 * visitor for a read-only strip would wake the room for every page view.
 */
export const CHAT_HISTORY_PATH = "/history";

/**
 * Path the Worker calls on the room stub to delete lines.
 *
 * The room does no authorisation of its own here: the Durable Object namespace
 * is only reachable through the Worker binding, and the Worker checks the admin
 * token before it forwards. Same trust boundary as CHAT_IP_HASH_HEADER.
 */
export const CHAT_ADMIN_DELETE_PATH = "/admin/delete";

/** How many lines the dashboard preview asks for. */
export const CHAT_PREVIEW_LIMIT = 8;

/**
 * How long the Worker may serve a cached preview.
 *
 * Long enough that the strip costs the room roughly one read per interval no
 * matter how many people are on the dashboard, short enough that the preview
 * does not look abandoned next to a live room.
 */
export const CHAT_PREVIEW_TTL_MS = 10_000;

/**
 * Lines the dashboard strip renders, on every screen size. The strip runs the
 * full width, so four fit on a phone.
 */
export const CHAT_PREVIEW_ROWS = 4;

/** How often the dashboard strip re-reads the preview. */
export const CHAT_PREVIEW_REFRESH_MS = 20_000;
