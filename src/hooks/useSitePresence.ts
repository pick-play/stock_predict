/**
 * Tells the server this tab is here, once a minute.
 *
 * The chat room reports how many people are on the site rather than how many
 * have the chat open (owner decision, 2026-08-22), and this is where that
 * number comes from for everyone who never enters the room. Mounted once at the
 * app root so a reader on the board or the dashboard counts too — the chat page
 * has a socket and is counted by that.
 *
 * Two rules keep the cost honest:
 *
 *   - a hidden tab pings nothing. Every request wakes a phone's radio, and a
 *     tab in the background has nobody looking at the count it maintains.
 *   - the interval is the whole cost of the feature, at one Durable Object
 *     request per visitor per minute. Shortening it multiplies that directly.
 *
 * It returns nothing. The count is read where it is displayed — the room pushes
 * it over the socket, and the dashboard's preview carries it — so nothing here
 * has to be threaded through the app.
 */

import { useEffect } from "react";
import {
  CHAT_PRESENCE_ENDPOINT,
  CHAT_PRESENCE_PING_MS,
} from "../lib/chat/config";
import { CHAT_API_BASE, isChatConfigured } from "../lib/chat/api";
import { isPresenceDue, notePresenceSent } from "../lib/chat/presenceClock";

export function useSitePresence() {
  useEffect(() => {
    if (!isChatConfigured) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    const ping = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      // The dashboard's preview poll announces presence as a flag on a request
      // it was making anyway. Where that is running, this has nothing to do.
      if (!isPresenceDue(CHAT_PRESENCE_PING_MS)) return;
      notePresenceSent();
      controller?.abort();
      controller = new AbortController();
      void fetch(`${CHAT_API_BASE}${CHAT_PRESENCE_ENDPOINT}`, {
        method: "POST",
        signal: controller.signal,
        // No body, no credentials: the server identifies the caller by address
        // alone, and there is nothing here worth attaching a session to.
      }).catch(() => {
        // A missed ping costs one visitor one minute of being counted.
      });
    };

    ping();
    const timer = window.setInterval(ping, CHAT_PRESENCE_PING_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
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
