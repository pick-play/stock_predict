/**
 * CommentSection — collapsible comment thread attached to a board post.
 *
 * Toggle opens the section and triggers a lazy fetch on first open.
 * Subsequent open/close cycles reuse the cached list.
 *
 * Writing requires login; reading is open to everyone.
 * Body is always rendered as plain text — never via dangerouslySetInnerHTML.
 */

import { useState } from "react";
import type { BoardComment } from "../../types/board";
import { BoardApiError } from "../../types/board";
import { reportComment } from "../../lib/board/api";
import { usePostComments } from "../../hooks/usePostComments";
import { CommentForm } from "./CommentForm";
import { PILL_QUIET, PILL_QUIET_DANGER } from "../common/controls";

// ── Time formatter (mirrors PostCard's formatBoardTime) ───────────────────────

function formatBoardTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return "—";
  }
}

// ── Single comment row ────────────────────────────────────────────────────────

type CommentReportState = "idle" | "confirming" | "sending" | "done" | "error";

function CommentRow({ comment }: { comment: BoardComment }) {
  const [reportState, setReportState] = useState<CommentReportState>("idle");
  const [reportError, setReportError] = useState<string | null>(null);

  const handleReportConfirm = async () => {
    setReportState("sending");
    try {
      await reportComment(comment.id);
      setReportState("done");
    } catch (e) {
      setReportError(
        e instanceof BoardApiError || e instanceof Error
          ? e.message
          : "신고 처리 중 오류가 발생했습니다."
      );
      setReportState("error");
    }
  };

  return (
    <div className="py-2.5 border-t border-[var(--border-subtle)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-semibold text-[#8b7cff]">
          {comment.authorTag}
        </span>
        <time
          className="text-[12px] text-[var(--text-muted)] tabular-nums"
          dateTime={comment.createdAt}
        >
          {formatBoardTime(comment.createdAt)}
        </time>
      </div>

      {/* Body — React auto-escapes; never use dangerouslySetInnerHTML */}
      <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words">
        {comment.body}
      </p>

      {/* Report action */}
      <div className="mt-1 flex justify-end" aria-live="polite">
        {reportState === "idle" && (
          <button
            type="button"
            onClick={() => setReportState("confirming")}
            className={PILL_QUIET}
            aria-label={`댓글 ${comment.id} 신고`}
          >
            신고
          </button>
        )}

        {reportState === "confirming" && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-tertiary)]">
              신고하시겠습니까?
            </span>
            <button
              type="button"
              onClick={handleReportConfirm}
              className={PILL_QUIET_DANGER}
              aria-label="신고 확인"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => setReportState("idle")}
              className={PILL_QUIET}
              aria-label="신고 취소"
            >
              취소
            </button>
          </div>
        )}

        {reportState === "sending" && (
          <span className="text-[11px] text-[var(--text-muted)]">신고 중…</span>
        )}

        {reportState === "done" && (
          <span className="text-[11px] text-[#31c48d]">
            신고가 접수되었습니다.
          </span>
        )}

        {reportState === "error" && (
          <span className="text-[11px] text-[#ff5d6c]">
            {reportError ?? "신고 처리 중 오류가 발생했습니다."}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CommentSkeleton() {
  return (
    <div
      className="mt-3 space-y-0"
      aria-busy="true"
      aria-label="댓글 불러오는 중"
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          className="py-2.5 border-t border-[var(--border-subtle)] animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex justify-between mb-1.5">
            <div className="h-2 w-14 rounded bg-[var(--surface-3)]" />
            <div className="h-2 w-12 rounded bg-[var(--surface-3)]" />
          </div>
          <div className="h-2 w-3/4 rounded bg-[var(--surface-3)]" />
        </div>
      ))}
    </div>
  );
}

// ── Comment section ───────────────────────────────────────────────────────────

interface CommentSectionProps {
  postId: string;
  /** Initial count from the parent post; updates after a new comment is added. */
  commentCount: number;
  authToken: string | null | undefined;
  authorNickname: string | null | undefined;
  /** Called when the user clicks "로그인 / 가입" inside the section. */
  onOpenAuth?: () => void;
}

export function CommentSection({
  postId,
  commentCount,
  authToken,
  authorNickname,
  onOpenAuth,
}: CommentSectionProps) {
  const [expanded, setExpanded] = useState(false);
  /** Live count that grows as new comments are added optimistically. */
  const [liveCount, setLiveCount] = useState(commentCount);

  const { comments, isLoading, error, hasMore, loadMore, appendComment } =
    usePostComments(postId, expanded);

  const handleCommentCreated = (comment: BoardComment) => {
    appendComment(comment);
    setLiveCount((n) => n + 1);
  };

  const displayCount = liveCount > 0 ? liveCount : commentCount;

  return (
    <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`comments-${postId}`}
        className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-100 rounded -ml-1 px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)]"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          aria-hidden="true"
          className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>댓글</span>
        {displayCount > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
            style={{
              background: "rgba(139,124,255,0.12)",
              color: "#8b7cff",
            }}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div id={`comments-${postId}`} className="mt-2">
          {/* Write area — requires login */}
          {authToken && authorNickname ? (
            <CommentForm
              postId={postId}
              authToken={authToken}
              authorNickname={authorNickname}
              onCommentCreated={handleCommentCreated}
            />
          ) : (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-3 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                댓글을 달려면 로그인해주세요.
              </p>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="mt-2 min-h-[36px] px-4 rounded-lg text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
                  style={{
                    background: "rgba(139,124,255,0.15)",
                    color: "#8b7cff",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(139,124,255,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(139,124,255,0.15)";
                  }}
                >
                  로그인 / 가입
                </button>
              )}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && <CommentSkeleton />}

          {/* Error */}
          {error && !isLoading && (
            <div
              className="mt-3 rounded-lg border border-[rgba(255,93,108,0.18)] bg-[rgba(255,93,108,0.05)] px-3 py-2"
              role="alert"
            >
              <p className="text-xs text-[#ff5d6c]">{error}</p>
            </div>
          )}

          {/* Comment list */}
          {!isLoading && comments.length > 0 && (
            <section
              aria-label={`글 ${postId}의 댓글 목록`}
              className="mt-2"
            >
              {comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}
            </section>
          )}

          {/* Empty state */}
          {!isLoading && !error && comments.length === 0 && (
            <p className="mt-3 text-[12px] text-[var(--text-muted)] text-center py-2">
              아직 댓글이 없습니다. 첫 댓글을 달아보세요.
            </p>
          )}

          {/* Pagination */}
          {hasMore && !isLoading && (
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={loadMore}
                className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#8b7cff]"
                aria-label="댓글 더 불러오기"
              >
                댓글 더 보기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
