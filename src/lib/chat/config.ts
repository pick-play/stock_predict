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
/**
 * How long a keepalive may go unanswered before the socket is treated as dead.
 *
 * Sending a ping proves nothing on its own. A phone that slept leaves the TCP
 * connection half-open: readyState stays OPEN, send() puts bytes in a buffer
 * that goes nowhere and throws nothing, and onclose does not arrive until the
 * kernel gives up — minutes later. For that whole window the room looks
 * connected and receives nothing, which is what "모바일에서 채팅이 안 뜬다"
 * actually was. The reply is what has to be waited for.
 *
 * Generous enough to survive a slow mobile round trip, short enough that a
 * reader notices a reconnect rather than a dead room.
 */
export const CHAT_PONG_TIMEOUT_MS = 10_000;

export const CHAT_PING_FRAME = "ping";
export const CHAT_PONG_FRAME = "pong";

/** Header the Worker uses to hand the server-derived identity to the room. */
export const CHAT_IP_HASH_HEADER = "X-Chat-Ip-Hash";

/**
 * Header carrying a logged-in member's nickname to the room.
 *
 * Set by the Worker only, and only from a ticket whose signature it has just
 * checked — the same trust boundary as the IP hash header. The room never reads
 * a name from a client frame, so a nickname on screen is always one the server
 * put there.
 */
export const CHAT_MEMBER_HANDLE_HEADER = "X-Chat-Member";

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
 * Internal path for a presence ping. Worker → room, never public.
 *
 * The count the room reports is site-wide as of 2026-08-22 (owner decision):
 * how many people are on kospinow.com, not how many have the chat open. Most
 * readers never enter the room, and "3명 접속" next to a conversation nobody is
 * in reads as a dead site rather than as an accurate socket count.
 */
export const CHAT_PRESENCE_PATH = "/presence";

/** Public route the browser pings. */
export const CHAT_PRESENCE_ENDPOINT = "/api/chat/presence";

/**
 * How often a tab announces itself.
 *
 * Every ping is one Durable Object request, so this is the whole cost of the
 * feature: one per visitor per minute, and none at all from a tab nobody is
 * looking at. Shortening it multiplies that directly.
 */
export const CHAT_PRESENCE_PING_MS = 60_000;

/**
 * How often a page with no socket re-reads the count (owner decision: 5s).
 *
 * Separate from the ping, because the two do different jobs: the ping says "I
 * am here" and only has to beat the expiry, while this is how quickly the
 * number on screen follows somebody else arriving. A count that only moved on
 * reload read as broken.
 *
 * A reader in the chat needs none of this — the room pushes the number over the
 * socket the moment it changes.
 *
 * Cost, plainly: twelve small Worker requests a minute per visible tab. Room
 * reads do not scale with it, because the Worker answers from a cache shared by
 * everyone (CHAT_COUNT_TTL_MS), so the Durable Object sees at most one read per
 * cache period however many people are watching.
 */
export const CHAT_PRESENCE_POLL_MS = 5_000;

/**
 * How long the Worker holds a count before asking the room again.
 *
 * Matched to the poll above: caching longer than the poll interval would serve
 * the same number twice and make the faster poll pure waste, and caching
 * shorter would ask the room for a number nobody has requested yet.
 */
export const CHAT_COUNT_TTL_MS = 5_000;

/** Public route for the count alone — no messages, a few bytes. */
export const CHAT_COUNT_ENDPOINT = "/api/chat/count";

/**
 * How long a ping counts for.
 *
 * Comfortably longer than the interval, so a visitor does not flicker out of
 * the count because one ping was slow. Short enough that someone who closed
 * the tab is gone within about two minutes.
 */
export const CHAT_PRESENCE_TTL_MS = 150_000;

/** Storage key holding the whole presence map, as one row. */
export const CHAT_PRESENCE_STORAGE_KEY = "site-presence";

/**
 * How often the presence map is written down.
 *
 * A Durable Object is evicted, relocated or restarted whenever the platform
 * likes — and every deploy does it deliberately — which used to empty the count
 * and leave it to climb back over the following minute. Persisting it removes
 * that sawtooth.
 *
 * One row for the entire map, rate-limited, so the write rate does not scale
 * with the audience: about 2,900 writes a day at this interval however many
 * people are here, against the ~33,000 the free plan allows (§28.3). Writing on
 * every ping instead would be one per visitor per minute, which is the shape of
 * cost this design exists to avoid.
 */
export const CHAT_PRESENCE_FLUSH_MS = 30_000;

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
