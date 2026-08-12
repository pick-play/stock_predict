/**
 * SharePreviewModal — shows the generated PNG before it leaves the device.
 *
 * Why a preview at all: the old flow handed the file straight to the OS share
 * sheet or the download folder, so the first time anyone saw the image was
 * after it had already been sent. Now the picture is on screen first, and
 * sharing is a deliberate second tap.
 *
 * Rendered through a portal into <body>. The card it belongs to is
 * `overflow-hidden` and animates with a transform, which both clips a
 * descendant and traps its z-index inside a stacking context — a `fixed`
 * overlay nested in it would be cut off rather than cover the page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, Download, X, Check } from "lucide-react";
import { BRAND_NAME } from "../../config/brand";

interface SharePreviewModalProps {
  /** Object URL of the generated PNG. Owned by the caller. */
  imageUrl: string;
  blob: Blob;
  fileName: string;
  displayName: string;
  onClose: () => void;
}

type ActionState = "idle" | "shared" | "saved" | "error";

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Can this browser put a file into the share sheet? */
function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined" || !("canShare" in navigator)) {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function SharePreviewModal({
  imageUrl,
  blob,
  fileName,
  displayName,
  onClose,
}: SharePreviewModalProps) {
  const [state, setState] = useState<ActionState>("idle");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const file = new File([blob], fileName, { type: "image/png" });
  const shareable = canShareFile(file);

  // Escape closes; focus moves in on open and back out on close.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // The page behind must not scroll under the sheet on a phone.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  // Reset the confirmation label so a second tap reads as a second action.
  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 2200);
    return () => window.clearTimeout(t);
  }, [state]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.share({
        title: `${displayName} 참고 예상가 | ${BRAND_NAME}`,
        text: `${displayName} 참고 예상가격 | kospinow.com`,
        files: [new File([blob], fileName, { type: "image/png" })],
      });
      setState("shared");
    } catch (err) {
      // Dismissing the share sheet is a choice, not a failure.
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[ShareCard] share failed:", err);
      setState("error");
    }
  }, [blob, displayName, fileName]);

  const handleSave = useCallback(() => {
    try {
      downloadBlob(blob, fileName);
      setState("saved");
    } catch (err) {
      console.error("[ShareCard] save failed:", err);
      setState("error");
    }
  }, [blob, fileName]);

  const feedback =
    state === "shared"
      ? "공유했습니다"
      : state === "saved"
        ? "저장했습니다"
        : state === "error"
          ? "실패했습니다. 다시 시도해 주세요."
          : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-preview-title"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(8, 11, 16, 0.78)" }}
      onClick={onClose}
    >
      <div
        // Taps inside the sheet must not reach the dismissing backdrop.
        onClick={(event) => event.stopPropagation()}
        className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)]"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <h2
            id="share-preview-title"
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            {displayName} 이미지 미리보기
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="미리보기 닫기"
            className="min-w-[36px] min-h-[36px] -mr-1 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-colors duration-150"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-4">
          <img
            src={imageUrl}
            alt={`${displayName} 참고 예상가 이미지`}
            className="w-full rounded-xl border border-[var(--border-subtle)]"
          />

          <p
            aria-live="polite"
            className="mt-3 min-h-[16px] text-xs text-center text-[var(--text-tertiary)]"
          >
            {feedback ??
              (shareable
                ? "공유하기로 메신저에 바로 보낼 수 있습니다."
                : "사진 저장을 누르면 기기에 내려받습니다.")}
          </p>

          <div className="mt-3 flex gap-2">
            {shareable && (
              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)",
                }}
              >
                {state === "shared" ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                )}
                공유하기
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              className={[
                "min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl",
                "text-sm font-medium border border-[var(--border-strong)]",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--surface-overlay)] transition-colors duration-150",
                shareable ? "px-4" : "flex-1",
              ].join(" ")}
            >
              {state === "saved" ? (
                <Check className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Download className="w-4 h-4" aria-hidden="true" />
              )}
              사진 저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
