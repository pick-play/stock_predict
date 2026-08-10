import { MarketTicker } from "../common/MarketTicker";

/**
 * Mobile-only bottom strip.
 *
 * It used to hold an "N초 전 갱신" clock. That reading now lives on each stock
 * card, next to the price it describes, so the fixed bar carries the market tape
 * instead — the one thing worth a permanently visible row on a small screen.
 *
 * Blurred rather than opaque so the content scrolling under it stays legible;
 * the page reserves space with pb-24 so nothing ends up trapped behind it.
 */
export function MobileBottomBar() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 md:hidden"
      style={{
        background: "color-mix(in srgb, var(--surface-1) 92%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <MarketTicker edge="bottom" />
    </div>
  );
}
