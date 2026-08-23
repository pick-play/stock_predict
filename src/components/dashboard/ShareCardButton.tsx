import { useState, useCallback, useEffect, useRef } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import type { StockSnapshot } from "../../types/market";
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
  /**
   * Styling from the card, so this sits in the same row as 차트 보기 and
   * 상세보기 rather than carrying a look of its own.
   */
  className?: string;
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
  className,
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
      /*
       * The canvas code arrives when it is first asked for.
       *
       * shareCard is the whole drawing routine — palette, rhythm constants,
       * text wrapping, the chart — and nothing on the page needs any of it
       * until this click. The user is already watching a "생성 중" state here,
       * so the one-time fetch hides inside the wait that exists anyway.
       */
      const { generateShareImage } = await import("../../lib/shareCard");
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
        : "공유하기";

  // Only the error state paints itself; the rest is whatever the card passes in.
  const stateClass = btnState === "error" ? "text-[#ff5d6c]" : "";

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={btnState === "generating"}
        aria-label={`${snapshot.displayName} 예상가격 이미지로 공유하기`}
        className={[className ?? "", stateClass].join(" ")}
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
