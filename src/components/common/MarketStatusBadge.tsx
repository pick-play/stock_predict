import { getMarketStatusLabel, isWeekend, isKrxTradingHours } from "../../lib/koreaMarket";
import { useKrxSession } from "../../hooks/useKrxSession";
import type { MarketStatus } from "../../lib/koreaMarket";

/**
 * The badge reports the session the market feed observes, not the one the
 * calendar predicts.
 *
 * When the clock says trading hours but the exchange is shut, that is a holiday
 * — 대체공휴일, 임시공휴일, an election day — and the badge says 국내 휴장
 * rather than inventing a session. §13 asks for exactly this: a weekday is not
 * proof of a trading day.
 */
export function MarketStatusBadge() {
  const { trading } = useKrxSession();

  const status: MarketStatus = trading
    ? "trading"
    : isWeekend()
      ? "weekend"
      : isKrxTradingHours()
        ? // Weekday, inside the hours, and still closed: a holiday.
          "holiday-unknown"
        : "overnight";

  const label = getMarketStatusLabel(status);

  const colorMap: Record<string, string> = {
    trading: "text-[#31c48d] bg-[rgba(49,196,141,0.1)]",
    closed: "text-[#a6b0c0] bg-surface-3",
    overnight: "text-[#8b7cff] bg-[rgba(139,124,255,0.1)]",
    weekend: "text-[#f5b942] bg-[rgba(245,185,66,0.1)]",
    "holiday-unknown": "text-[#a6b0c0] bg-surface-3",
    "data-stale": "text-[#ff5d6c] bg-[rgba(255,93,108,0.1)]",
    "baseline-needed": "text-[#f5b942] bg-[rgba(245,185,66,0.1)]",
  };

  const color = colorMap[status] ?? "text-[#a6b0c0] bg-surface-3";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
