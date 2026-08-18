/**
 * Chat room types shared between the browser client and the Cloudflare Worker.
 * Mirrors the contract defined in docs/chat-api.md.
 *
 * Every field a reader sees is authored by the server. The browser may only
 * ever send a body string — id, handle and createdAt are assigned server-side
 * so a client cannot impersonate another participant or forge ordering.
 */

/** One chat line. */
export interface ChatMessage {
  /** Monotonic sequence number as a string. Also the render/ordering key. */
  id: string;
  /** Plain text — caller must render as text, never set as innerHTML. */
  body: string;
  /**
   * Server-generated display handle: a logged-in member's nickname, or a daily
   * alias like "느긋한 수달" for an anonymous sender. Either way the server
   * assigns it — a client cannot state its own name.
   */
  handle: string;
  /**
   * True when the handle is a member nickname.
   *
   * Needed on screen: an anonymous alias is two ordinary Korean words, so a
   * member could register a nickname shaped exactly like one. The badge this
   * flag drives is what tells them apart.
   */
  isMember?: boolean;
  createdAt: string;
}

/** Frames the browser may send. Anything else is dropped by the server. */
export type ChatClientEvent = { type: "message"; body: string };

/** Why the server refused a frame. */
export type ChatRejectCode =
  | "invalid"
  | "empty"
  | "too-long"
  | "rejected"
  | "rate-limited";

/** Frames the server sends. */
export type ChatServerEvent =
  | {
      type: "hello";
      handle: string;
      participants: number;
      messages: ChatMessage[];
    }
  | { type: "message"; message: ChatMessage }
  | { type: "presence"; participants: number }
  /**
   * Lines a moderator removed. Sent to everyone, including the sender, so a
   * deleted message cannot survive on a screen that already received it.
   */
  | { type: "deleted"; ids: string[] }
  | { type: "rejected"; code: ChatRejectCode; message: string };

/**
 * Connection lifecycle as the UI sees it.
 * "gated" means a join ticket is still required (Turnstile not cleared yet);
 * "unavailable" means the deployment has no chat backend at all.
 */
export type ChatConnectionStatus =
  | "gated"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "unavailable";

export type ChatErrorKind =
  | "captcha-failed"
  | "invalid-ticket"
  | "rate-limited"
  | "unavailable"
  | "network";

/** Typed error thrown by chat API calls. */
export class ChatApiError extends Error {
  readonly kind: ChatErrorKind;

  constructor(kind: ChatErrorKind, message: string) {
    super(message);
    this.name = "ChatApiError";
    this.kind = kind;
  }
}

/** Short-lived join ticket returned by POST /api/chat/ticket. */
export interface ChatTicket {
  ticket: string;
  /** Nickname the room will show, when the ticket was minted for a member. */
  handle?: string | null;
  /** ISO 8601 UTC. The client re-gates once this passes. */
  expiresAt: string;
}
