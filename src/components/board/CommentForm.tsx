/**
 * CommentForm — inline comment input for a single post.
 *
 * Security contract:
 *   - body is rendered as plain text throughout; never assigned to innerHTML.
 *   - moderatePost() gives the writer a client-side warning. The Worker has
 *     final authority and may still reject the comment.
 *   - authToken is always required by the caller (only shown when logged in).
 *   - A ref-lock prevents concurrent submits.
 */

import { useState, useRef } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { moderatePost } from "../../lib/moderation/filter";
import { submitComment } from "../../lib/board/api";
import { BoardApiError } from "../../types/board";
import type { BoardComment } from "../../types/board";

/** Max length mirroring the server-side limit from board-api.md. */
const COMMENT_MAX_LENGTH = 500;

interface CommentFormProps {
  postId: string;
  authToken: string;
  authorNickname: string;
  onCommentCreated: (comment: BoardComment) => void;
}

export function CommentForm({
  postId,
  authToken,
  authorNickname,
  onCommentCreated,
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const handleBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    setSubmitError(null);
    if (val.trim().length > 0) {
      const result = moderatePost(val);
      setModerationWarning(result.ok ? null : (result.message ?? null));
    } else {
      setModerationWarning(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const trimmed = body.trim();
    if (trimmed.length < 1) return;

    const modResult = moderatePost(trimmed);
    if (!modResult.ok) {
      setModerationWarning(modResult.message ?? "입력 내용을 다시 확인해주세요.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const comment = await submitComment(postId, {
        body: trimmed,
        authToken,
      });
      setBody("");
      setModerationWarning(null);
      onCommentCreated(comment);
    } catch (e) {
      if (e instanceof BoardApiError) {
        setSubmitError(e.message);
      } else {
        setSubmitError("등록할 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const remaining = COMMENT_MAX_LENGTH - body.length;
  const isBodyValid =
    body.trim().length >= 1 &&
    !moderationWarning &&
    body.length <= COMMENT_MAX_LENGTH;
  const canSubmit = isBodyValid && !isSubmitting;

  const inputId = `comment-body-${postId}`;
  const modId = `comment-mod-${postId}`;
  const errId = `comment-err-${postId}`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="댓글 작성"
      className="mt-3"
    >
      <label htmlFor={inputId} className="sr-only">
        댓글 (최대 {COMMENT_MAX_LENGTH}자)
      </label>
      <textarea
        id={inputId}
        value={body}
        onChange={handleBodyChange}
        rows={2}
        maxLength={COMMENT_MAX_LENGTH + 10}
        placeholder={`${authorNickname}으로 댓글 달기…`}
        disabled={isSubmitting}
        aria-invalid={!!moderationWarning || body.length > COMMENT_MAX_LENGTH}
        aria-describedby={
          moderationWarning ? modId : submitError ? errId : undefined
        }
        className="w-full resize-none rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] px-2.5 py-2 leading-relaxed transition-colors duration-150 focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[rgba(139,124,255,0.3)] disabled:opacity-50"
      />

      <div className="flex items-center justify-between mt-1 px-0.5">
        <span
          aria-live="polite"
          aria-label={`남은 글자 수 ${remaining}자`}
          className={`text-[12px] tabular-nums transition-colors duration-100 ${
            remaining < 0
              ? "text-[#ff5d6c]"
              : remaining < 50
              ? "text-[#f5b942]"
              : "text-[var(--text-muted)]"
          }`}
        >
          {body.length > 0
            ? remaining < 0
              ? `+${String(-remaining)}자 초과`
              : `${remaining}자 남음`
            : `최대 ${COMMENT_MAX_LENGTH}자`}
        </span>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-label={isSubmitting ? "댓글 등록 중" : "댓글 등록"}
          className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canSubmit
              ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
              : "rgba(139,124,255,0.15)",
            color: canSubmit ? "#fff" : "var(--text-muted)",
          }}
        >
          {isSubmitting ? "등록 중…" : "등록"}
        </button>
      </div>

      {moderationWarning && (
        <p
          id={modId}
          role="alert"
          aria-live="assertive"
          className="text-xs text-[#f5b942] bg-[rgba(245,185,66,0.07)] border border-[rgba(245,185,66,0.14)] rounded-lg px-2.5 py-1.5 mt-1.5 leading-relaxed"
        >
          {moderationWarning}
        </p>
      )}

      {submitError && (
        <p
          id={errId}
          role="alert"
          aria-live="assertive"
          className="text-xs text-[#ff5d6c] bg-[rgba(255,93,108,0.07)] border border-[rgba(255,93,108,0.14)] rounded-lg px-2.5 py-1.5 mt-1.5 leading-relaxed"
        >
          {submitError}
        </p>
      )}
    </form>
  );
}
