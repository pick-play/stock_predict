import { useState } from "react";
import type { BoardPost } from "../../types/board";
import { BoardApiError } from "../../types/board";
import { reportPost, likePost } from "../../lib/board/api";
import { CommentSection } from "./CommentSection";

interface PostCardProps {
  post: BoardPost;
  /** Bearer token for the logged-in user; undefined/null means unauthenticated. */
  authToken?: string | null;
  /** Display nickname of the logged-in user. */
  authorNickname?: string | null;
  /** Called when the user taps "로그인 / 가입" inside the comment area. */
  onOpenAuth?: () => void;
}

const LIKED_STORAGE_KEY = "board:liked";

/**
 * Remembers which posts this browser already liked. The server enforces one
 * like per daily IP hash; this only keeps the button in its pressed state
 * across visits so the reader is not invited to press it again for nothing.
 */
function readLikedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberLiked(id: string): void {
  try {
    const ids = readLikedIds();
    ids.add(id);
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Private mode or a full quota — the button still works for this session.
  }
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

export function PostCard({
  post,
  authToken,
  authorNickname,
  onOpenAuth,
}: PostCardProps) {
  const [reportState, setReportState] = useState<ReportState>("idle");
  const [reportError, setReportError] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liked, setLiked] = useState(() => readLikedIds().has(post.id));
  const [likePending, setLikePending] = useState(false);

  const handleLike = async () => {
    if (liked || likePending) return;

    // Optimistic: the press should feel instant, and the server is the source
    // of truth for the count we settle on.
    setLikePending(true);
    setLiked(true);
    setLikeCount((n) => n + 1);

    try {
      const result = await likePost(post.id);
      setLikeCount(result.likeCount);
      rememberLiked(post.id);
    } catch {
      setLiked(false);
      setLikeCount(post.likeCount);
    } finally {
      setLikePending(false);
    }
  };

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
          className="text-[12px] text-[var(--text-muted)] tabular-nums"
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

      {/* ── Footer: like + report actions ── */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleLike}
          disabled={liked || likePending}
          aria-pressed={liked}
          aria-label={
            liked ? `공감함 · 공감 ${likeCount}개` : `이 글에 공감하기 · 현재 ${likeCount}개`
          }
          className={`min-h-[44px] -my-2 pr-3 flex items-center gap-1.5 text-xs rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)] ${
            liked
              ? "text-[#ff4d5e] cursor-default"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <span aria-hidden="true" className="text-sm leading-none">
            {liked ? "♥" : "♡"}
          </span>
          <span className="tabular-nums">{likeCount}</span>
        </button>

        <div className="flex items-center gap-2" aria-live="polite">
        {reportState === "idle" && (
          <button
            type="button"
            onClick={handleReportClick}
            className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors duration-100 rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)]"
            aria-label={`글 id ${post.id} 신고`}
          >
            신고
          </button>
        )}

        {reportState === "confirming" && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--text-tertiary)]">
              신고하시겠습니까?
            </span>
            <button
              type="button"
              onClick={handleReportConfirm}
              className="text-[12px] text-[#ff5d6c] hover:opacity-80 transition-opacity rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff5d6c]"
              aria-label="신고 확인"
            >
              확인
            </button>
            <button
              type="button"
              onClick={handleReportCancel}
              className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors rounded px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)]"
              aria-label="신고 취소"
            >
              취소
            </button>
          </div>
        )}

        {reportState === "sending" && (
          <span className="text-[12px] text-[var(--text-muted)]">신고 중…</span>
        )}

        {reportState === "done" && (
          <span className="text-[12px] text-[#31c48d]">
            신고가 접수되었습니다.
          </span>
        )}

          {reportState === "error" && (
            <span className="text-[12px] text-[#ff5d6c]">
              {reportError ?? "신고 처리 중 오류가 발생했습니다."}
            </span>
          )}
        </div>
      </div>
      {/* ── Comments ── */}
      <CommentSection
        postId={post.id}
        commentCount={post.commentCount ?? 0}
        authToken={authToken}
        authorNickname={authorNickname}
        onOpenAuth={onOpenAuth}
      />
    </article>
  );
}
