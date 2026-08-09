import { useState, useEffect } from "react";
import { usePopularTicker } from "../../hooks/usePopularTicker";
import { likePost, isBoardConfigured } from "../../lib/board/api";

/**
 * Dashboard ticker that vertically rolls through popular board posts.
 *
 * Design principles:
 * - Secondary element — compact strip that does not compete with price data.
 * - Calm vertical roll on auto-advance (not a flashy horizontal marquee).
 * - Pauses on hover or keyboard focus so users can read comfortably.
 * - Like button supports optimistic UI with server reconciliation.
 * - post.body is NEVER rendered as HTML; React renders it as text only.
 */

const ADVANCE_INTERVAL_MS = 5_000;

interface LikeState {
  count: number;
  liked: boolean;
  pending: boolean;
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function HeartFilledIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="text-[#ff4d5e]"
    >
      <path d="M12 21.593c-.525-.438-10.56-7.616-10.56-13.067 0-3.341 2.572-5.526 5.28-5.526 1.868 0 3.591 1.025 5.28 3.007 1.69-1.982 3.412-3.007 5.28-3.007 2.708 0 5.28 2.185 5.28 5.526 0 5.451-10.035 12.629-10.56 13.067z" />
    </svg>
  );
}

function HeartOutlineIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PopularTicker() {
  const { posts } = usePopularTicker();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});

  // Sync like states when the post list first arrives or changes
  useEffect(() => {
    if (posts.length === 0) return;
    setIdx(0);
    setLikeStates((prev) => {
      const next: Record<string, LikeState> = {};
      for (const post of posts) {
        // Preserve any in-session liked/count state the user already set
        next[post.id] = prev[post.id] ?? {
          count: post.likeCount,
          liked: false,
          pending: false,
        };
      }
      return next;
    });
  }, [posts]);

  // Auto-advance (pause while hovered / focused)
  useEffect(() => {
    if (paused || posts.length <= 1) return;
    const timer = window.setInterval(() => {
      setIdx((i) => (i + 1) % posts.length);
    }, ADVANCE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, posts.length]);

  // Nothing to show — don't render at all (no empty space left behind)
  if (!isBoardConfigured || posts.length === 0) return null;

  const post = posts[idx];
  if (!post) return null;

  const ls: LikeState = likeStates[post.id] ?? {
    count: post.likeCount,
    liked: false,
    pending: false,
  };

  const handleLike = async () => {
    if (ls.pending) return;
    const snapshot = ls;
    // Optimistic update
    setLikeStates((s) => ({
      ...s,
      [post.id]: {
        count: ls.liked ? ls.count : ls.count + 1,
        liked: true,
        pending: true,
      },
    }));
    try {
      const result = await likePost(post.id);
      setLikeStates((s) => ({
        ...s,
        [post.id]: { count: result.likeCount, liked: true, pending: false },
      }));
    } catch {
      // Revert on error
      setLikeStates((s) => ({
        ...s,
        [post.id]: { ...snapshot, pending: false },
      }));
    }
  };

  return (
    <div
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-label="토론방 인기글"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Label */}
        <span
          className="shrink-0 text-[10px] font-semibold tracking-wider text-[var(--text-tertiary)] uppercase select-none"
          aria-hidden="true"
        >
          토론
        </span>

        {/* Vertical divider */}
        <div
          className="shrink-0 w-px h-3 bg-[var(--border-subtle)]"
          aria-hidden="true"
        />

        {/* Rolling content — keyed so React remounts it on each advance,
            triggering the CSS entry animation (calm vertical roll from below). */}
        <div
          key={`${post.id}-${idx}`}
          className="flex-1 min-w-0 flex items-baseline gap-1.5 animate-ticker-in"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="shrink-0 text-[11px] font-medium text-[var(--text-tertiary)]">
            {post.authorTag}
          </span>
          {/* post.body must stay as plain text — no dangerouslySetInnerHTML */}
          <span className="text-xs text-[var(--text-secondary)] truncate">
            {post.body}
          </span>
        </div>

        {/* Like button */}
        <button
          type="button"
          onClick={handleLike}
          disabled={ls.pending}
          className="shrink-0 flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)] disabled:opacity-40"
          aria-label={`공감 ${ls.count}개${ls.liked ? ", 공감함" : ""}`}
          aria-pressed={ls.liked}
        >
          {ls.liked ? <HeartFilledIcon /> : <HeartOutlineIcon />}
          <span className="tabular-nums">{ls.count}</span>
        </button>

        {/* Progress dots — visual only, no tab-stop */}
        {posts.length > 1 && (
          <div
            className="shrink-0 flex items-center gap-0.5"
            aria-hidden="true"
          >
            {posts.map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full transition-colors duration-300 ${
                  i === idx
                    ? "bg-[var(--text-tertiary)]"
                    : "bg-[var(--border-subtle)]"
                }`}
              />
            ))}
          </div>
        )}

        {/* Pause indicator — shown when hovered/focused */}
        {paused && (
          <span
            className="shrink-0 text-[9px] text-[var(--text-muted)] select-none"
            aria-hidden="true"
          >
            ∥
          </span>
        )}
      </div>
    </div>
  );
}
