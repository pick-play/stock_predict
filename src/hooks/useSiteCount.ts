/**
 * Keeps the site headcount fresh for pages that have no socket.
 *
 * The room pushes the number to anyone sitting in the chat the moment it moves,
 * so this exists for everywhere else — the dashboard strip, mainly, where the
 * count only changed on reload before.
 *
 * Same two rules as the presence ping: nothing from a hidden tab, and the
 * interval is the entire cost. That cost lands on the Worker, not on the room:
 * the count is served from a cache shared by every caller, so the Durable
 * Object is read once per cache period however many people are watching.
 *
 * The number is published into the shared store rather than returned, because
 * what displays it is the strip, several components away.
 */

import { useEffect } from "react";
import {
  CHAT_COUNT_ENDPOINT,
  CHAT_PRESENCE_POLL_MS,
} from "../lib/chat/config";
import { CHAT_API_BASE, isChatConfigured } from "../lib/chat/api";
import { publishParticipants } from "../lib/chat/livePreview";

export function useSiteCount() {
  useEffect(() => {
    if (!isChatConfigured) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    const read = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(`${CHAT_API_BASE}${CHAT_COUNT_ENDPOINT}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload: unknown = await res.json();
        const participants = (payload as { participants?: unknown })
          ?.participants;
        if (!cancelled && typeof participants === "number") {
          publishParticipants(participants);
        }
      } catch {
        // Keep the last number. A count that blinks out on one failed read is
        // worse than one that is a few seconds old.
      }
    };

    void read();
    const timer = window.setInterval(() => void read(), CHAT_PRESENCE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void read();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
