/**
 * This week's most-liked community posts, four of them, beside the chat strip.
 *
 * The endpoint already means "weekly hot" — /api/posts/popular filters to the
 * last seven days and orders by likes — so nothing server-side was needed.
 *
 * A list rather than the rolling ticker this replaced on the dashboard. Four
 * titles at once are read in a glance; one title at a time asks the reader to
 * wait for the rest, which is the wrong trade beside a chat strip that is also
 * moving. Four on a phone too: the strip is full width, so they fit.
 *
 * Bodies are rendered as text children, never innerHTML.
 */

import { usePopularTicker } from "../../hooks/usePopularTicker";
import { COMMUNITY_HOT_COUNT } from "../../config/community";

interface CommunityHotListProps {
  onNavigateBoard?: () => void;
}

function HeartIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 21.593c-.525-.438-10.56-7.616-10.56-13.067 0-3.341 2.572-5.526 5.28-5.526 1.868 0 3.591 1.025 5.28 3.007 1.69-1.982 3.412-3.007 5.28-3.007 2.708 0 5.28 2.185 5.28 5.526 0 5.451-10.035 12.629-10.56 13.067z" />
    </svg>
  );
}

export function CommunityHotList({ onNavigateBoard }: CommunityHotListProps) {
  const { posts } = usePopularTicker();

  // Nothing to show and nothing to promise: take up no space.
  if (posts.length === 0) return null;

  const hot = posts.slice(0, COMMUNITY_HOT_COUNT);

  return (
    /*
     * The whole card opens the community, matching the chat strip beside it. No
     * like button here — the one on the old ticker had to stop propagation to
     * avoid throwing the reader onto the board, and a list of four would need
     * four such exceptions for an action that belongs on the post itself.
     */
    <section
      className={`animate-fade-in rounded-2xl border border-[var(--border-subtle)] bg-surface-1 px-4 py-3${
        onNavigateBoard
          ? " cursor-pointer transition-colors duration-150 hover:border-[var(--border-strong)]"
          : ""
      }`}
      onClick={onNavigateBoard}
      onKeyDown={
        onNavigateBoard &&
        ((event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigateBoard();
          }
        })
      }
      role={onNavigateBoard ? "button" : undefined}
      tabIndex={onNavigateBoard ? 0 : undefined}
      aria-label={
        onNavigateBoard ? "커뮤니티 주간 인기글 — 눌러서 열기" : "커뮤니티 주간 인기글"
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)]">
            커뮤니티
          </h2>
          <span className="text-[12px] text-[var(--text-tertiary)]">
            이번 주 인기
          </span>
        </div>
        {onNavigateBoard && (
          <span
            className="shrink-0 text-[13px] text-[var(--text-tertiary)]"
            aria-hidden="true"
          >
            →
          </span>
        )}
      </div>

      <ol className="space-y-1">
        {hot.map((post, index) => (
          <li key={post.id} className="flex items-baseline gap-2 text-xs">
            <span className="w-3 shrink-0 text-center text-[12px] tabular-nums text-[var(--text-muted)]">
              {index + 1}
            </span>
            {/* post.body must stay plain text — no dangerouslySetInnerHTML */}
            <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
              {post.body}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] tabular-nums text-[var(--text-tertiary)]">
              <HeartIcon />
              {post.likeCount}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
