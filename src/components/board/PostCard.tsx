import { useState } from "react";
import type { BoardPost } from "../../types/board";
import { BoardApiError } from "../../types/board";
import { reportPost } from "../../lib/board/api";

interface PostCardProps {
  post: BoardPost;
}

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

type ReportState = "idle" | "confirming" | "sending" | "done" | "error";

export function PostCard({ post }: PostCardProps) {
  const [reportState, setReportState] = useState<ReportState>("idle");
  const [reportError, setReportError] = useState<string | null>(null);

  const handleReportClick = () => setReportState("confirming");
  const handleReportCancel = () => setReportState("idle");

  const handleReportConfirm = async () => {
    setReportState("sending");
    setReportError(null);
    try {
      await reportPost(post.id, "");
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
    <article
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 hover:border-[var(--border-strong)] transition-colors duration-150"
      aria-label={`${post.authorTag}의 글`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {post.authorTag}
        </span>
        <time
          className="text-[10px] text-[var(--text-muted)] tabular-nums"
          dateTime={post.createdAt}
        >
          {formatBoardTime(post.createdAt)}
        </time>
      </div>

      {/* ── Body — React auto-escapes; never use dangerouslySetInnerHTML ── */}
      <p
        className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words"
      >
        {post.body}
      </p>

      {/* ── Footer: report action ── */}
      <div className="mt-3 flex items-center justify-end gap-2" aria-live="polite">
        {reportState === "idle" && (
          <button
            type="button"
            onClick={handleReportClick}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors duration-100 rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)]"
            aria-label={`글 id ${post.id} 신고`}
          >
            신고
          </button>
        )}

        {reportState === "confirming" && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-tertiary)]">
              신고하시겠습니까?
            </span>
            <button
              type="button"
              onClick={handleReportConfirm}
              className="text-[10px] text-[#ff5d6c] hover:opacity-80 transition-opacity rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff5d6c]"
              aria-label="신고 확인"
            >
              확인
            </button>
            <button
              type="button"
              onClick={handleReportCancel}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)]"
              aria-label="신고 취소"
            >
              취소
            </button>
          </div>
        )}

        {reportState === "sending" && (
          <span className="text-[10px] text-[var(--text-muted)]">신고 중…</span>
        )}

        {reportState === "done" && (
          <span className="text-[10px] text-[#31c48d]">
            신고가 접수되었습니다.
          </span>
        )}

        {reportState === "error" && (
          <span className="text-[10px] text-[#ff5d6c]">
            {reportError ?? "신고 처리 중 오류가 발생했습니다."}
          </span>
        )}
      </div>
    </article>
  );
}
