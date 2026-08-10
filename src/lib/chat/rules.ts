/**
 * Chat rules. Pure functions with no platform dependencies, so the browser can
 * warn while typing and the Worker can make the same call authoritatively —
 * one rule set, no drift. Same arrangement as moderation/filter.ts.
 *
 * The browser check is a courtesy only. The room is anonymous, so these rules
 * plus the join ticket are the entire abuse defence; every one of them must
 * hold server-side.
 */

import { moderatePost } from "../moderation/filter";
import type { ChatClientEvent, ChatMessage, ChatRejectCode } from "../../types/chat";
import {
  CHAT_MESSAGE_CAP,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_RATE_WINDOW_MAX,
  CHAT_RATE_WINDOW_MS,
  CHAT_SEND_MIN_INTERVAL_MS,
} from "./config";

// ── Message validation ────────────────────────────────────────────────────────

export interface ChatValidation {
  ok: boolean;
  code?: ChatRejectCode;
  /** Message shown to the sender. Explains the rule, never quotes the match. */
  message?: string;
  /** Trimmed text to store. Present only when ok is true. */
  body?: string;
}

function reject(code: ChatRejectCode, message: string): ChatValidation {
  return { ok: false, code, message };
}

/**
 * Applies every content rule to one outgoing line.
 *
 * The length check runs before moderatePost() on purpose: the shared filter
 * would answer a 5,000-character paste with the board's 1,000-character
 * message, which is the wrong number to show a chat sender.
 *
 * Note that moderatePost() also rejects single-character bodies as too short.
 * That is inherited deliberately — forking the filter to allow "ㅋ" would mean
 * two rule sets to keep in sync, and a one-character floor costs little.
 */
export function validateChatMessage(raw: unknown): ChatValidation {
  if (typeof raw !== "string") {
    return reject("invalid", "메시지를 보낼 수 없습니다.");
  }

  const body = raw.trim();

  if (body.length === 0) {
    return reject("empty", "메시지를 입력해주세요.");
  }
  if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
    return reject("too-long", `${CHAT_MESSAGE_MAX_LENGTH}자 이내로 입력해주세요.`);
  }

  const moderation = moderatePost(body);
  if (!moderation.ok) {
    return reject("rejected", moderation.message ?? "보낼 수 없는 내용입니다.");
  }

  return { ok: true, body };
}

// ── Client frame parsing ──────────────────────────────────────────────────────

/**
 * Turns a raw socket frame into a known event, or null.
 *
 * Anything unrecognised is refused rather than coerced: the room accepts one
 * frame shape and a malformed frame is far more likely to be a probe than a
 * real participant.
 */
export function parseChatClientEvent(raw: string): ChatClientEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as { type?: unknown; body?: unknown };
  if (candidate.type !== "message" || typeof candidate.body !== "string") {
    return null;
  }

  return { type: "message", body: candidate.body };
}

// ── Display handle ────────────────────────────────────────────────────────────

/**
 * Derives the display handle from the daily-rotating IP hash.
 *
 * Deliberately not the board's "익명#" prefix: board anonymity was retired by
 * owner decision (CLAUDE.md §28.2) and reusing the tag would make deleted
 * board posts and live chat lines look like the same identity system.
 */
export function chatHandleFromIpHash(ipHash: string): string {
  const suffix = ipHash.slice(0, 4);
  return `손님#${suffix.length === 4 ? suffix : "0000"}`;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

export interface ChatRateVerdict {
  allowed: boolean;
  /** Milliseconds until the sender may try again. 0 when allowed. */
  retryAfterMs: number;
  /**
   * Timestamps to keep for the next call. The accepted send is already
   * appended, so the caller stores this verbatim and never mutates its own copy.
   */
  history: number[];
}

/**
 * Sliding-window limiter over accepted send times for one IP hash.
 *
 * Two limits, because they stop different things: the minimum interval stops a
 * script pushing frames as fast as the socket allows, and the window cap stops
 * a human-paced flood that stays under it.
 */
export function evaluateChatRate(
  history: readonly number[],
  now: number
): ChatRateVerdict {
  const recent = history.filter((at) => now - at < CHAT_RATE_WINDOW_MS);

  const last = recent.length > 0 ? Math.max(...recent) : null;
  if (last !== null && now - last < CHAT_SEND_MIN_INTERVAL_MS) {
    return {
      allowed: false,
      retryAfterMs: CHAT_SEND_MIN_INTERVAL_MS - (now - last),
      history: recent,
    };
  }

  if (recent.length >= CHAT_RATE_WINDOW_MAX) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      retryAfterMs: CHAT_RATE_WINDOW_MS - (now - oldest),
      history: recent,
    };
  }

  return { allowed: true, retryAfterMs: 0, history: [...recent, now] };
}

// ── Rolling window ───────────────────────────────────────────────────────────

/**
 * Reference semantics for the room's retention rule: append, then keep only
 * the newest `cap` entries.
 *
 * The Durable Object evicts by sequence number rather than by rewriting a list
 * (see messageStore.ts); this function is what that arithmetic has to agree
 * with, and it is what the client applies to its own view so a long-lived tab
 * does not grow without bound.
 */
export function appendWithCap<T>(
  messages: readonly T[],
  next: T,
  cap: number = CHAT_MESSAGE_CAP
): T[] {
  if (cap <= 0) return [];
  const appended = [...messages, next];
  return appended.length > cap ? appended.slice(appended.length - cap) : appended;
}

/** Type guard for a server-authored message arriving over the socket. */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["body"] === "string" &&
    typeof candidate["handle"] === "string" &&
    typeof candidate["createdAt"] === "string"
  );
}
