import { useState, useCallback } from "react";
import { Share2, Download, Check, Loader2 } from "lucide-react";
import type { StockSnapshot } from "../../types/market";
import { generateShareImage } from "../../lib/shareCard";

interface ShareCardButtonProps {
  snapshot: StockSnapshot;
}

type ButtonState = "idle" | "generating" | "success" | "error";

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

/**
 * Renders a small share/download button attached to a stock estimate card.
 *
 * Visibility rule: only rendered when snapshot.status === "healthy" so that
 * an image without real numbers is never distributed.
 *
 * Share flow:
 *   1. Generate a PNG via Canvas (includes disclaimer + kospinow.com).
 *   2. If the Web Share API can accept files → share sheet.
 *   3. Otherwise → trigger a file download.
 */
export function ShareCardButton({ snapshot }: ShareCardButtonProps) {
  const [btnState, setBtnState] = useState<ButtonState>("idle");

  // Detect whether the browser supports file sharing via the Web Share API.
  // We check at render time so the icon can reflect the action before the
  // user taps.
  const supportsFileShare =
    typeof navigator !== "undefined" && "canShare" in navigator;

  const handleClick = useCallback(async () => {
    if (btnState === "generating") return;

    setBtnState("generating");

    try {
      const blob = await generateShareImage(snapshot);

      // Build a locale-aware file name from the current KST date.
      const dateTag = new Date()
        .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
        .replace(/\. /g, "-")
        .replace(/\.$/, "");
      const fileName = `${snapshot.displayName}-예상가-${dateTag}.png`;

      let shared = false;

      if (supportsFileShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        const shareData: ShareData = {
          title: `${snapshot.displayName} 참고 예상가 | KOSPI NOW`,
          text: `${snapshot.displayName} 참고 예상가격 | kospinow.com`,
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          shared = true;
        }
      }

      // Fallback: download when share API is unavailable or files not accepted.
      if (!shared) {
        downloadBlob(blob, fileName);
      }

      setBtnState("success");
      setTimeout(() => setBtnState("idle"), 2000);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User dismissed the share sheet — not an error.
        setBtnState("idle");
        return;
      }
      console.error("[ShareCard] image generation error:", err);
      setBtnState("error");
      setTimeout(() => setBtnState("idle"), 2500);
    }
  }, [btnState, snapshot, supportsFileShare]);

  // ── Label + icon ────────────────────────────────────────────────────────
  const label =
    btnState === "generating"
      ? "생성 중..."
      : btnState === "success"
        ? "완료"
        : btnState === "error"
          ? "오류"
          : supportsFileShare
            ? "공유"
            : "저장";

  const icon =
    btnState === "generating" ? (
      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
    ) : btnState === "success" ? (
      <Check className="w-3 h-3" aria-hidden="true" />
    ) : supportsFileShare ? (
      <Share2 className="w-3 h-3" aria-hidden="true" />
    ) : (
      <Download className="w-3 h-3" aria-hidden="true" />
    );

  // ── Colour state ────────────────────────────────────────────────────────
  const stateClass =
    btnState === "success"
      ? "text-[#31c48d] border-[#31c48d]/30 bg-[#31c48d]/10"
      : btnState === "error"
        ? "text-[#ff5d6c] border-[#ff5d6c]/30 bg-[#ff5d6c]/10"
        : [
            "text-[var(--text-tertiary)] border-[var(--border-subtle)] bg-transparent",
            "hover:text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
            "hover:bg-[var(--surface-overlay)]",
          ].join(" ");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={btnState === "generating"}
      aria-label={`${snapshot.displayName} 예상가격 이미지 ${supportsFileShare ? "공유" : "저장"}`}
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
        "text-[11px] font-medium border",
        "transition-all duration-150 ease-out",
        "cursor-pointer select-none min-h-[28px] min-w-[44px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        stateClass,
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
