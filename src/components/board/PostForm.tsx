/**
 * PostForm — new post creation form.
 *
 * Security contract:
 *   - body is rendered as plain text throughout; never assigned to innerHTML.
 *   - moderatePost() from filter.ts gives the writer a client-side warning.
 *     The Worker has final authority and may still reject the post.
 *   - The honeypot field is positioned off-screen with aria-hidden; it is
 *     never visible or tab-reachable by real users.
 *   - Turnstile token is required when isTurnstileConfigured is true.
 *   - A ref-lock prevents concurrent submits.
 */

import { useState, useCallback, useRef } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { moderatePost, BODY_MAX_LENGTH } from "../../lib/moderation/filter";
import { submitPost } from "../../lib/board/api";
import { BoardApiError } from "../../types/board";
import type { BoardPost } from "../../types/board";
import { TurnstileWidget } from "./TurnstileWidget";
import { isTurnstileConfigured } from "../../lib/board/turnstileConfig";
import { PILL_PRIMARY } from "../common/controls";

interface PostFormProps {
  onPostCreated: (post: BoardPost) => void;
  /** Bearer token for logged-in posts. When provided the server records
   *  the member's nickname as authorTag. Omit for anonymous posts. */
  authToken?: string | null;
  /** Display name of the logged-in user, for the "posting as" label. */
  authorNickname?: string | null;
}

export function PostForm({ onPostCreated, authToken, authorNickname }: PostFormProps) {
  const [body, setBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [moderationWarning, setModerationWarning] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileLoadError, setTurnstileLoadError] = useState(false);
  const submitLockRef = useRef(false);

  // ── Body change ─────────────────────────────────────────────────────────────
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

  // ── Turnstile callbacks (stable refs required by TurnstileWidget) ──────────
  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileLoadError(false);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileLoadError(true);
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const trimmed = body.trim();

    // Final client-side moderation check before hitting the network
    const modResult = moderatePost(trimmed);
    if (!modResult.ok) {
      setModerationWarning(modResult.message ?? "입력 내용을 다시 확인해주세요.");
      return;
    }

    if (isTurnstileConfigured && !turnstileToken) {
      setSubmitError("보안 문자를 완료해주세요.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const post = await submitPost({
        body: trimmed,
        turnstileToken: turnstileToken ?? "",
        authToken: authToken ?? undefined,
      });
      setBody("");
      setModerationWarning(null);
      setTurnstileToken(null);
      onPostCreated(post);
    } catch (e) {
      if (e instanceof BoardApiError) {
        setSubmitError(e.message);
        if (e.kind === "captcha-failed") setTurnstileToken(null);
      } else {
        setSubmitError("등록할 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  const remaining = BODY_MAX_LENGTH - body.length;
  const isBodyValid = body.trim().length >= 2 && !moderationWarning;
  const canSubmit =
    isBodyValid &&
    !isSubmitting &&
    (!isTurnstileConfigured || turnstileToken !== null);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
      noValidate
      aria-label="새 글 작성"
    >
      <h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3 tracking-widest uppercase">
        새 글 작성
      </h3>

      {/* ── Honeypot — must be invisible and unreachable by real users ── */}
      {/* aria-hidden prevents screen readers from announcing it */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          opacity: 0,
        }}
      >
        <input
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* ── Body textarea ── */}
      <div className="mb-3">
        <label htmlFor="board-body" className="sr-only">
          본문 (2자 이상 {BODY_MAX_LENGTH}자 이내)
        </label>
        <textarea
          id="board-body"
          name="body"
          value={body}
          onChange={handleBodyChange}
          rows={4}
          maxLength={BODY_MAX_LENGTH + 50} /* let the validation message show before hard cut */
          placeholder="국내 주요 종목 야간 가격에 대한 의견을 남겨주세요."
          disabled={isSubmitting}
          aria-invalid={!!moderationWarning || (body.length > BODY_MAX_LENGTH)}
          aria-describedby={
            moderationWarning
              ? "board-mod-warning"
              : submitError
              ? "board-submit-error"
              : "board-char-count"
          }
          className="w-full resize-none rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] px-3 py-2.5 leading-relaxed transition-colors duration-150 focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[rgba(139,124,255,0.3)] disabled:opacity-50"
        />

        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span
            id="board-char-count"
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
              ? `${remaining < 0 ? "+" + String(-remaining) + "자 초과" : remaining + "자 남음"}`
              : `최대 ${BODY_MAX_LENGTH}자`}
          </span>
          <span className="text-[12px] text-[var(--text-muted)]">
            {authorNickname ? (
              <>
                <span className="text-[#8b7cff]">{authorNickname}</span>
                {"으로 게시"}
              </>
            ) : (
              "익명"
            )}
          </span>
        </div>
      </div>

      {/* ── Client-side moderation warning ── */}
      {moderationWarning && (
        <p
          id="board-mod-warning"
          role="alert"
          aria-live="assertive"
          className="text-xs text-[#f5b942] bg-[rgba(245,185,66,0.07)] border border-[rgba(245,185,66,0.14)] rounded-lg px-3 py-2 mb-3 leading-relaxed"
        >
          {moderationWarning}
        </p>
      )}

      {/* ── Turnstile ── */}
      <div className="mb-3">
        <TurnstileWidget
          onToken={handleTurnstileToken}
          onExpire={handleTurnstileExpire}
          onError={handleTurnstileError}
        />
        {turnstileLoadError && (
          <p className="text-xs text-[#ff5d6c] mt-1.5" role="alert">
            보안 문자를 불러올 수 없습니다. 페이지를 새로고침 해주세요.
          </p>
        )}
      </div>

      {/* ── Submit error ── */}
      {submitError && (
        <p
          id="board-submit-error"
          role="alert"
          aria-live="assertive"
          className="text-xs text-[#ff5d6c] bg-[rgba(255,93,108,0.07)] border border-[rgba(255,93,108,0.14)] rounded-lg px-3 py-2 mb-3 leading-relaxed"
        >
          {submitError}
        </p>
      )}

      {/* ── Submit button ── */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label={isSubmitting ? "등록 중" : "글 등록"}
          className={PILL_PRIMARY}
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
    </form>
  );
}
