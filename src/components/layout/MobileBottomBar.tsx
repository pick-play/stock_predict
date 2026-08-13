import { MarketTicker } from "../common/MarketTicker";

/**
 * Mobile-only bottom strip.
 *
 * It used to hold an "N초 전 갱신" clock. That reading now lives on each stock
 * card, next to the price it describes, so the fixed bar carries the market tape
 * instead — the one thing worth a permanently visible row on a small screen.
 *
 * Opaque, not blurred. It used to carry backdrop-filter: blur(12px) at 92%
 * opacity — eight percent of see-through for a filter the compositor had to
 * re-run over a full-width strip on every animation frame, because the market
 * tape inside it never stops moving. On a phone that is a permanent GPU load
 * and it was warm to the touch. The page reserves space with pb-24 so nothing
 * ends up trapped behind the bar either way.
 */
export function MobileBottomBar() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 md:hidden"
      style={{
        background: "var(--surface-1)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <MarketTicker edge="bottom" />
    </div>
  );
}
