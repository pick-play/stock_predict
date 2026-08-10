/**
 * Read-only client for GET /api/chat/recent.
 *
 * Separate from api.ts because that module is about joining: it trades a
 * Turnstile token for a ticket and opens a socket. This one only reads, needs no
 * identity, and is called from the dashboard by people who never enter the room.
 */

import { z } from "zod";
import { CHAT_API_BASE, isChatConfigured } from "./api";

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

  try {
    const res = await fetch(`${CHAT_API_BASE}/api/chat/recent`, { signal });
    if (!res.ok) return null;
    const parsed = RecentChatSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.warn("[chat] recent preview failed", err);
    }
    return null;
  }
}
