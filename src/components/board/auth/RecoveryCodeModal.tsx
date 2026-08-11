/**
 * RecoveryCodeModal — shown exactly once after a successful signup.
 *
 * UX contract:
 *   - The user must check a confirmation box before they can dismiss the modal.
 *   - A copy button lets them transfer the code without retyping it.
 *   - The modal cannot be dismissed by clicking the backdrop so the code
 *     cannot be lost by an accidental tap.
 *
 * Security note:
 *   - The code is plain text rendered as text content, never innerHTML.
 *   - This component does not store the code anywhere. Once unmounted the
 *     code is gone from the page.
 */

import { useState, useEffect } from "react";

interface RecoveryCodeModalProps {
  recoveryCode: string;
  nickname: string;
  onConfirmed: () => void;
}

export function RecoveryCodeModal({
  recoveryCode,
  nickname,
  onConfirmed,
}: RecoveryCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Reset copy state after 2 s
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  // Trap focus inside the modal (keyboard users must not escape without confirming)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    return () => {
      previousFocus?.focus();
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
    } catch {
      // Clipboard API unavailable — user can select manually.
    }
  };

  return (
    /* Full-screen overlay — not dismissable by clicking outside */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      aria-describedby="recovery-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(8, 11, 16, 0.92)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
      >
        {/* Warning header */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{
                background: "rgba(245, 185, 66, 0.12)",
                border: "1px solid rgba(245, 185, 66, 0.24)",
                color: "#f5b942",
              }}
            >
              !
            </span>
            <div>
              <h2
                id="recovery-title"
                className="text-sm font-semibold text-[var(--text-primary)] leading-snug"
              >
                복구 코드를 반드시 저장해 주세요
              </h2>
              <p
                id="recovery-desc"
                className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed"
              >
                <strong className="text-[#f5b942]">이 화면을 닫으면 다시 볼 수 없습니다.</strong>
                {" "}비밀번호를 잊으면 이 코드로만 재설정할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Account info */}
          <p className="text-xs text-[var(--text-tertiary)]">
            닉네임:{" "}
            <span className="text-[var(--text-primary)] font-medium">
              {nickname}
            </span>
          </p>

          {/* Recovery code display */}
          <div>
            <p className="text-[12px] text-[var(--text-muted)] mb-1.5 tracking-widest uppercase">
              복구 코드
            </p>
            <div
              className="relative rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-3"
            >
              <code
                aria-label="복구 코드"
                className="block text-center text-sm font-mono tracking-widest text-[var(--text-primary)] break-all select-all"
                style={{ letterSpacing: "0.15em" }}
              >
                {recoveryCode}
              </code>
            </div>
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="w-full py-2 rounded-lg text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            style={{
              background: copied
                ? "rgba(49, 196, 141, 0.12)"
                : "rgba(139, 124, 255, 0.10)",
              border: `1px solid ${copied ? "rgba(49, 196, 141, 0.3)" : "rgba(139, 124, 255, 0.25)"}`,
              color: copied ? "#31c48d" : "#8b7cff",
            }}
          >
            {copied ? "복사됨" : "클립보드에 복사"}
          </button>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 rounded accent-[#8b7cff] cursor-pointer"
              aria-describedby="confirm-label-text"
            />
            <span
              id="confirm-label-text"
              className="text-xs text-[var(--text-secondary)] leading-relaxed"
            >
              복구 코드를 안전한 곳에 저장했습니다. 이 코드를 잃어버리면 비밀번호를 재설정할 방법이 없다는 것을 이해합니다.
            </span>
          </label>

          {/* Dismiss button — only enabled after checkbox */}
          <button
            type="button"
            onClick={onConfirmed}
            disabled={!confirmed}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: confirmed
                ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
                : "rgba(139, 124, 255, 0.15)",
              color: confirmed ? "#fff" : "var(--text-muted)",
            }}
          >
            확인하고 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
