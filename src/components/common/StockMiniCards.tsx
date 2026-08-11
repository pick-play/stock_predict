/**
 * Compact live prices for the two stocks, for pages that are not the dashboard.
 *
 * The board and the chat room are where people talk about the number, so the
 * number should be in front of them without a trip back. Same hook the dashboard
 * cards use, so the figure and its live state cannot disagree between pages —
 * only one route is mounted at a time, so this costs one feed, not two.
 *
 * Deliberately reduced: price, change, and whether it is live. No anchor
 * breakdown, no chart, no share button. Someone who wants those goes to the
 * dashboard, and this strip has to stay out of the way of the conversation.
 */

import { useMarketData } from "../../hooks/useMarketData";
import {
  formatKrw,
  formatPercent,
  formatDirectionSymbol,
  getDirection,
} from "../../lib/format";
import { getDataFreshness } from "../../lib/staleData";
import type { StockId } from "../../types/market";

const STOCK_IDS: StockId[] = ["samsung", "skHynix"];

const DIRECTION_CLASS: Record<string, string> = {
  rise: "text-rise",
  fall: "text-fall",
  neutral: "text-[var(--text-secondary)]",
};

interface StockMiniCardsProps {
  onNavigateDashboard?: () => void;
}

export function StockMiniCards({ onNavigateDashboard }: StockMiniCardsProps) {
  const { stocks, wsStatus } = useMarketData();

  const ready = STOCK_IDS.map((id) => stocks[id]).filter(
    (snapshot) => snapshot !== undefined && snapshot.status === "healthy"
  );

  // Nothing trustworthy to show yet. A talk page should not open with a skeleton
  // where a price will be; the dashboard is where the loading states belong.
  if (ready.length === 0) return null;

  // 실시간 is claimed only when the socket is up and the tick is recent, the same
  // rule the dashboard cards use. Anything else and the badge stays off.
  const anyFresh = ready.some(
    (snapshot) => getDataFreshness(snapshot!.eventTime) === "fresh"
  );
  const isLive = wsStatus === "connected" && anyFresh;

  return (
    <section
      className="animate-fade-in px-4 pt-3 md:px-6"
      aria-label="삼성전자 · SK하이닉스 예상가"
    >
      <div className="grid grid-cols-2 gap-2">
        {ready.map((snapshot) => {
          const direction = getDirection(snapshot!.changeRate);
          return (
            <div
              key={snapshot!.koreanTicker}
              className="rounded-xl border border-[var(--border-subtle)] bg-surface-1 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] text-[var(--text-secondary)]">
                  {snapshot!.displayName}
                </span>
                {isLive && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-success">
                    <span
                      className="h-1 w-1 rounded-full bg-success animate-pulse"
                      aria-hidden="true"
                    />
                    실시간
                  </span>
                )}
              </div>

              <p className="mt-1 text-[17px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
                {formatKrw(snapshot!.estimatedPrice)}
              </p>

              {/* Arrow and sign carry the direction beside the colour (§11.2, §19). */}
              <p
                className={`mt-1 text-[13px] tabular-nums ${DIRECTION_CLASS[direction]}`}
              >
                {formatDirectionSymbol(snapshot!.changeRate)}{" "}
                {formatPercent(snapshot!.changeRate)}
              </p>
            </div>
          );
        })}
      </div>

      {/* The cards show a reference estimate, not a traded price. The pages this
          strip appears on have no disclaimer of their own, so it says so here
          rather than relying on the dashboard's (§21). */}
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
        해외 선물가격 기반 참고 예상가입니다.{" "}
        {onNavigateDashboard && (
          <button
            type="button"
            onClick={onNavigateDashboard}
            className="underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-[var(--text-secondary)]"
          >
            자세히 보기
          </button>
        )}
      </p>
    </section>
  );
}
