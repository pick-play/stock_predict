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

import { useCallback, useEffect, useRef } from "react";
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
  "flex h-[56dvh] flex-col overflow-y-auto overflow-x-hidden px-4 py-3 md:h-[60dvh] md:px-6";

interface ChatMessageListProps {
  messages: ChatMessage[];
  /** Own handle, used to tint matching lines. Null until the server assigns one. */
  ownHandle: string | null;
}

export function ChatMessageList({ messages, ownHandle }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFollowingRef = useRef(true);

  /**
   * Follow state is recorded from the reader's own scrolling, not from a layout
   * effect after the append.
   *
   * A layout effect measuring the same render that added the messages sees the
   * grown scrollHeight against the unchanged scrollTop, so a whole backlog
   * arriving at once measured as "scrolled far from the bottom" and suppressed
   * the very scroll that should have followed it. Entering the room therefore
   * landed on the oldest line with the newest ones below the fold. A single
   * appended message stayed under the threshold by luck, which is why only the
   * first paint looked wrong.
   */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isFollowingRef.current = distance <= FOLLOW_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isFollowingRef.current) return;
    // Direct assignment rather than a smooth scroll: the page sets
    // scroll-behavior globally, and an animated jump on every incoming message
    // is exactly what prefers-reduced-motion readers do not want.
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={TRANSCRIPT_CLASS}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="채팅 대화 내용"
      tabIndex={0}
    >
      {messages.length === 0 ? (
        <p className="m-auto py-12 text-center text-sm text-[var(--text-tertiary)]">
          아직 대화가 없습니다. 먼저 인사를 건네보세요.
        </p>
      ) : (
        /*
         * mt-auto is what makes a short conversation sit on the floor of the
         * transcript and grow upward, the way every chat app behaves. Without it
         * the list starts at the top of a 56dvh box and fills downward, which
         * reads as a document rather than a conversation.
         *
         * Chosen over `justify-end` on the container: that collapses the top of
         * the content once it overflows in several browsers, which would hide the
         * oldest messages instead of letting them scroll.
         */
        <ol className="mt-auto space-y-2">
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
                    className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]"
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
