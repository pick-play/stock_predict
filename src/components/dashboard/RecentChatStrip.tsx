/**
 * The live chat room's latest lines, at the top of the dashboard.
 *
 * It leads the page by owner decision; the board strip that used to sit beside
 * it was removed from the dashboard, and the board is reached from the header.
 *
 * Polled rather than socketed on purpose. Opening a WebSocket per dashboard
 * visitor would wake the chat room for people who never enter it, and the room
 * is only cheap while it is hibernating. The Worker caches the preview, so the
 * room sees roughly one read per cache interval no matter how many people are
 * looking at the dashboard.
 *
 * Bodies are rendered as text children, never innerHTML — the server stores
 * whatever the sender typed.
 */

import { useEffect, useState } from "react";
import { fetchRecentChat } from "../../lib/chat/recentApi";
import type { RecentChat } from "../../lib/chat/recentApi";
import { isChatConfigured } from "../../lib/chat/api";
import {
  CHAT_PREVIEW_REFRESH_MS,
  CHAT_PREVIEW_ROWS,
} from "../../lib/chat/config";
import { formatChatTime } from "../../lib/chat/formatChatTime";
import { useNow } from "../../hooks/useNow";
import { formatKoreanTimeDetailed } from "../../lib/format";

interface RecentChatStripProps {
  onNavigateChat?: () => void;
}

export function RecentChatStrip({ onNavigateChat }: RecentChatStripProps) {
  const [data, setData] = useState<RecentChat | null>(null);
  // Relative labels for the first hour, so they need a clock that moves.
  const now = useNow();

  useEffect(() => {
    if (!isChatConfigured) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const next = await fetchRecentChat(controller.signal);
      // Keep the previous lines on a failed refresh rather than blanking a strip
      // that was correct a moment ago.
      if (!cancelled && next) setData(next);
    };

    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, CHAT_PREVIEW_REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Nothing to show and nothing to promise: take up no space.
  if (!data || data.messages.length === 0) return null;

  // Newest first here, unlike the room itself — a preview is read top-down.
  const lines = [...data.messages].reverse().slice(0, CHAT_PREVIEW_ROWS);

  return (
    /*
     * The whole card activates the room rather than only a corner link — on a
     * phone the lines themselves are the obvious tap target, and a reader who
     * wants in should not have to find a small "열기".
     */
    <section
      className={`animate-fade-in rounded-2xl border border-[var(--border-subtle)] bg-surface-1 px-4 py-3${
        onNavigateChat
          ? " cursor-pointer transition-colors duration-150 hover:border-[var(--border-strong)]"
          : ""
      }`}
      onClick={onNavigateChat}
      onKeyDown={
        onNavigateChat &&
        ((event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigateChat();
          }
        })
      }
      role={onNavigateChat ? "button" : undefined}
      tabIndex={onNavigateChat ? 0 : undefined}
      aria-label={
        onNavigateChat ? "실시간 채팅 — 눌러서 열기" : "실시간 채팅"
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-[var(--text-secondary)]">
            실시간 채팅
          </h2>
          <span className="inline-flex items-center gap-1 text-[12px] text-success">
            <span
              className="h-1 w-1 rounded-full bg-success animate-pulse"
              aria-hidden="true"
            />
            {data.participants}명 접속
          </span>
        </div>
        {onNavigateChat && (
          <span
            className="shrink-0 text-[13px] text-[var(--text-tertiary)]"
            aria-hidden="true"
          >
            →
          </span>
        )}
      </div>

      <ol className="space-y-1">
        {lines.map((message) => (
          <li key={message.id} className="flex items-baseline gap-2 text-xs">
            <span className="shrink-0 truncate font-medium text-[var(--text-tertiary)] max-w-[7.5rem]">
              {message.handle}
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
              {message.body}
            </span>
            <time
              dateTime={message.createdAt}
              title={formatKoreanTimeDetailed(message.createdAt)}
              className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]"
            >
              {formatChatTime(message.createdAt, now)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
