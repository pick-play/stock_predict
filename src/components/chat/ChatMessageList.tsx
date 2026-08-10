/**
 * The transcript.
 *
 * Bodies are rendered as text children, never as innerHTML — the server stores
 * whatever the sender typed, so escaping is this component's job.
 *
 * Auto-scroll only follows when the reader is already at the bottom. Yanking the
 * viewport while someone is reading back through history is worse than making
 * them scroll down themselves.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ChatMessage } from "../../types/chat";
import { formatChatTime } from "../../lib/chat/formatChatTime";
import { formatKoreanTimeDetailed } from "../../lib/format";

/** How far from the bottom still counts as "following the conversation". */
const FOLLOW_THRESHOLD_PX = 64;

/**
 * A fixed viewport-relative height rather than flex-1 inside a 100dvh column.
 * DashboardLayout renders a ticker strip above this page on desktop, so pinning
 * to the full viewport would push the composer below the fold by exactly that
 * strip's height — a number this component has no business knowing.
 */
const TRANSCRIPT_CLASS =
  "h-[56dvh] overflow-y-auto overflow-x-hidden px-4 py-3 md:h-[60dvh] md:px-6";

interface ChatMessageListProps {
  messages: ChatMessage[];
  /** Own handle, used to tint matching lines. Null until the server assigns one. */
  ownHandle: string | null;
}

export function ChatMessageList({ messages, ownHandle }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasFollowingRef = useRef(true);

  // Recorded before paint so the decision uses the pre-append scroll position.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasFollowingRef.current = distance <= FOLLOW_THRESHOLD_PX;
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !wasFollowingRef.current) return;
    // Direct assignment rather than a smooth scroll: the page sets
    // scroll-behavior globally, and an animated jump on every incoming message
    // is exactly what prefers-reduced-motion readers do not want.
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className={TRANSCRIPT_CLASS}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="채팅 대화 내용"
      tabIndex={0}
    >
      {messages.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--text-tertiary)]">
          아직 대화가 없습니다. 먼저 인사를 건네보세요.
        </p>
      ) : (
        <ol className="space-y-2">
          {messages.map((message) => {
            const isOwnHandle =
              ownHandle !== null && message.handle === ownHandle;

            return (
              <li
                key={message.id}
                className="animate-fade-in rounded-xl border px-3 py-2"
                style={{
                  borderColor: isOwnHandle
                    ? "rgba(139,124,255,0.24)"
                    : "var(--border-subtle)",
                  background: isOwnHandle
                    ? "rgba(139,124,255,0.06)"
                    : "var(--surface-1)",
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="truncate text-xs font-semibold"
                    style={{
                      color: isOwnHandle ? "#8b7cff" : "var(--text-secondary)",
                    }}
                  >
                    {message.handle}
                  </span>
                  <time
                    dateTime={message.createdAt}
                    title={formatKoreanTimeDetailed(message.createdAt)}
                    className="shrink-0 text-[10px] tabular-nums text-[var(--text-muted)]"
                  >
                    {formatChatTime(message.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-primary)]">
                  {message.body}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
