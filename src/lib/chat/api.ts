/**
 * Chat API client.
 *
 * The chat endpoints are served by the same Worker as the board, so this
 * deliberately reads the same VITE_BOARD_API_BASE variable instead of adding a
 * second one — two variables could disagree and produce a deployment where the
 * board works and the chat silently points nowhere. When it is absent,
 * isChatConfigured is false and callers must show the "준비 중" state rather
 * than attempt any connection, matching the board's behaviour.
 */

import type { ChatTicket } from "../../types/chat";
import { ChatApiError } from "../../types/chat";
import { resolveApiBase } from "../apiBase";

export const CHAT_API_BASE = resolveApiBase(
  import.meta.env.VITE_BOARD_API_BASE as string | undefined
);

export const isChatConfigured = CHAT_API_BASE.length > 0;

const TICKET_STORAGE_KEY = "kospinow.chat.ticket";

const ERROR_KIND_MAP: Partial<Record<string, ChatApiError["kind"]>> = {
  "captcha-failed": "captcha-failed",
  "invalid-ticket": "invalid-ticket",
  "rate-limited": "rate-limited",
  "chat-unavailable": "unavailable",
};

// ── Join ticket ───────────────────────────────────────────────────────────────

/**
 * Trades a Turnstile token for a short-lived join ticket.
 *
 * The ticket exists so a dropped connection does not demand a fresh CAPTCHA:
 * Turnstile tokens are single-use, and a room that re-challenged on every
 * reconnect would punish exactly the people with unreliable networks.
 */
export async function requestChatTicket(
  turnstileToken: string,
  signal?: AbortSignal
): Promise<ChatTicket> {
  let res: Response;
  try {
    res = await fetch(`${CHAT_API_BASE}/api/chat/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ turnstileToken }),
      signal,
    });
  } catch {
    throw new ChatApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 200) {
    const data = (await res.json()) as ChatTicket;
    return data;
  }

  const errBody = (await res.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  throw new ChatApiError(
    ERROR_KIND_MAP[errBody?.error ?? ""] ?? "network",
    errBody?.message ?? "실시간 채팅에 입장할 수 없습니다."
  );
}

// ── Ticket cache ──────────────────────────────────────────────────────────────

/**
 * sessionStorage, not localStorage: the ticket is bound to the visitor's IP
 * hash and expires within the hour, so persisting it past the tab's life would
 * only ever hand back something already invalid.
 */
export function loadCachedTicket(now: number = Date.now()): ChatTicket | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(TICKET_STORAGE_KEY);
  } catch {
    // Private browsing modes can throw on access — treat as "no ticket".
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ChatTicket>;
    if (typeof parsed.ticket !== "string" || typeof parsed.expiresAt !== "string") {
      return null;
    }
    const expiresAt = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    return { ticket: parsed.ticket, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function storeTicket(ticket: ChatTicket): void {
  try {
    window.sessionStorage.setItem(TICKET_STORAGE_KEY, JSON.stringify(ticket));
  } catch (error) {
    // Not fatal: the visitor just re-gates on their next reconnect.
    console.warn("[chat] could not cache the join ticket", error);
  }
}

export function clearCachedTicket(): void {
  try {
    window.sessionStorage.removeItem(TICKET_STORAGE_KEY);
  } catch (error) {
    console.warn("[chat] could not clear the join ticket", error);
  }
}

// ── Socket URL ────────────────────────────────────────────────────────────────

/** Builds the room's WebSocket URL for a ticket. Returns null when unconfigured. */
export function chatSocketUrl(ticket: string): string | null {
  if (!isChatConfigured) return null;
  const wsBase = CHAT_API_BASE.replace(/^http/, "ws");
  return `${wsBase}/api/chat/room?ticket=${encodeURIComponent(ticket)}`;
}
