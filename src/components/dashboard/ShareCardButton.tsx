import { useState, useCallback, useEffect, useRef } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import type { StockSnapshot } from "../../types/market";
import { generateShareImage } from "../../lib/shareCard";
import { SharePreviewModal } from "./SharePreviewModal";

interface ShareCardButtonProps {
  snapshot: StockSnapshot;
  /**
   * Recent estimated prices for the image's chart, oldest first — the same
   * series the card's sparkline draws. It lives on the page rather than in the
   * snapshot, so it has to be handed down; without it the image simply omits
   * the chart, which is what it did before.
   */
  sparklineData?: number[];
}

type ButtonState = "idle" | "generating" | "error";

interface Preview {
  url: string;
  blob: Blob;
  fileName: string;
}

/** e.g. 2026-08-12, from the KST calendar rather than the device's. */
function kstDateTag(): string {
  return new Date()
    .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
    .replace(/\. /g, "-")
    .replace(/\.$/, "");
}

/**
 * Renders a small save/share button attached to a stock estimate card.
 *
 * Visibility rule: only rendered when snapshot.status === "healthy" so that
 * an image without real numbers is never distributed.
 *
 * Share flow:
 *   1. Generate a PNG via Canvas (includes disclaimer + kospinow.com).
 *   2. Show it in a preview dialog — the sender sees the picture before it
 *      goes anywhere. It used to be handed straight to the share sheet or the
 *      download folder, sight unseen.
 *   3. From the preview: share sheet where files are supported, download
 *      otherwise. Both remain available.
 */
export function ShareCardButton({
  snapshot,
  sparklineData,
}: ShareCardButtonProps) {
  const [btnState, setBtnState] = useState<ButtonState>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);

  /*
   * One object URL is alive at a time, and only while the dialog holds it.
   * Kept in a ref as well so unmounting mid-preview (navigation, a snapshot
   * going unhealthy) revokes it without touching state on a dead component.
   */
  const urlRef = useRef<string | null>(null);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    revokeUrl();
    setPreview(null);
  }, [revokeUrl]);

  useEffect(() => revokeUrl, [revokeUrl]);

  useEffect(() => {
    if (btnState !== "error") return;
    const t = window.setTimeout(() => setBtnState("idle"), 2500);
    return () => window.clearTimeout(t);
  }, [btnState]);

  const handleClick = useCallback(async () => {
    if (btnState === "generating") return;

    setBtnState("generating");

    try {
      const blob = await generateShareImage(snapshot, {
        sparkline: sparklineData,
      });
      const fileName = `${snapshot.displayName}-예상가-${kstDateTag()}.png`;

      revokeUrl();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPreview({ url, blob, fileName });
      setBtnState("idle");
    } catch (err) {
      console.error("[ShareCard] image generation error:", err);
      setBtnState("error");
    }
  }, [btnState, snapshot, sparklineData, revokeUrl]);

  const label =
    btnState === "generating"
      ? "생성 중..."
      : btnState === "error"
        ? "오류"
        : "사진 저장";

  const stateClass =
    btnState === "error"
      ? "text-[#ff5d6c] border-[#ff5d6c]/30 bg-[#ff5d6c]/10"
      : [
          "text-[var(--text-tertiary)] border-[var(--border-subtle)] bg-transparent",
          "hover:text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
          "hover:bg-[var(--surface-overlay)]",
        ].join(" ");

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={btnState === "generating"}
        aria-label={`${snapshot.displayName} 예상가격 이미지 만들기`}
        className={[
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
          "text-[13px] font-medium border",
          "transition-all duration-150 ease-out",
          "cursor-pointer select-none min-h-[28px] min-w-[44px]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          stateClass,
        ].join(" ")}
      >
        {btnState === "generating" ? (
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        ) : (
          <ImageDown className="w-3 h-3" aria-hidden="true" />
        )}
        {label}
      </button>

      {preview && (
        <SharePreviewModal
          imageUrl={preview.url}
          blob={preview.blob}
          fileName={preview.fileName}
          displayName={snapshot.displayName}
          onClose={closePreview}
        />
      )}
    </>
  );
}
