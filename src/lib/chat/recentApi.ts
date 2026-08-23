/**
 * Read-only client for GET /api/chat/recent.
 *
 * Separate from api.ts because that module is about joining: it trades a
 * Turnstile token for a ticket and opens a socket. This one only reads, needs no
 * identity, and is called from the dashboard by people who never enter the room.
 */

import { z } from "zod";
import { CHAT_API_BASE, isChatConfigured } from "./api";
import { CHAT_PRESENCE_PING_MS } from "./config";
import { isPresenceDue, notePresenceSent } from "./presenceClock";

const RecentChatSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().min(1),
      body: z.string(),
      handle: z.string().min(1),
      createdAt: z.string().datetime(),
    })
  ),
  participants: z.number().int().nonnegative(),
});

export type RecentChat = z.infer<typeof RecentChatSchema>;

/**
 * Returns null on anything unexpected — unreachable, non-2xx, or a payload that
 * does not validate. The strip is secondary furniture on a price dashboard; it
 * hides itself rather than turning a preview hiccup into a visible error.
 */
export async function fetchRecentChat(
  signal?: AbortSignal
): Promise<RecentChat | null> {
  if (!isChatConfigured) return null;

  /*
   * Presence rides along rather than costing a request of its own.
   *
   * This poll is already happening; adding a flag to it is free, where a
   * separate ping is 60 requests per visitor-hour against a daily budget for
   * the whole site. The flag is set only when one is actually due, so a faster
   * preview poll does not turn into a faster presence rate.
   */
  const withPresence = isPresenceDue(CHAT_PRESENCE_PING_MS);
  const url = withPresence
    ? `${CHAT_API_BASE}/api/chat/recent?presence=1`
    : `${CHAT_API_BASE}/api/chat/recent`;

  try {
    const res = await fetch(url, { signal, method: withPresence ? "POST" : "GET" });
    if (!res.ok) return null;
    const parsed = RecentChatSchema.safeParse(await res.json());
    // Only once the server has actually answered: a failed request announced
    // nothing, and pretending otherwise drops this tab out of the count.
    if (parsed.success && withPresence) notePresenceSent();
    return parsed.success ? parsed.data : null;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.warn("[chat] recent preview failed", err);
    }
    return null;
  }
}
