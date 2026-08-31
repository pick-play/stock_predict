import { useState, useId } from "react";
import { ChartPlot } from "./ChartPlot";
import { useElementWidth } from "../../hooks/useElementWidth";
import type { HistoryEntry, StockId } from "../../types/market";
import { MARKET_SYMBOLS, STOCK_IDS } from "../../config/symbols";
import type { ChartRange } from "../../lib/binance/klineHistory";

interface PriceChartProps {
  history: HistoryEntry[];
  krxClose?: Partial<Record<StockId, number>>;
  /** Owned by the page: the range decides which candles are fetched. */
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  isLoading?: boolean;
  /**
   * Pins the chart to one stock and replaces the selector with that stock's name.
   *
   * Set by the dashboard, where the chart is opened from one card's 차트 보기 and
   * so already has a subject; a selector offering the other company would
   * contradict the button that opened it.
   */
  stockId?: StockId;
}

type TimeRange = ChartRange;

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "1시간",
  "6h": "6시간",
  "24h": "24시간",
  "7d": "7일",
};

/**
 * Read from the symbol table rather than listed here.
 *
 * A hand-written map is a second place to add a stock, and it was already one
 * short: five listings were added and this still had two, so the chart's tab
 * strip could not name them.
 */
const STOCK_LABELS: Record<StockId, string> = Object.fromEntries(
  STOCK_IDS.map((id) => [id, MARKET_SYMBOLS[id].displayName])
) as Record<StockId, string>;

export function PriceChart({
  history,
  krxClose,
  range,
  onRangeChange,
  isLoading = false,
  stockId,
}: PriceChartProps) {
  const [selectedStock, setSelectedStock] = useState<StockId>(STOCK_IDS[0]);
  // A pinned stock overrides the selector's state rather than syncing to it, so
  // the chart cannot drift from the card whose button opened it.
  const activeStock = stockId ?? selectedStock;
  const timeRange = range;
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const gradientId = `pg-${uid}`;
  // The plot is drawn at a measured pixel width: axis labels have to stay
  // upright and evenly spaced, which a stretched viewBox cannot do.
  const { ref: plotRef, width: plotWidth } = useElementWidth<HTMLDivElement>();

  const now = Date.now();
  const cutoff = now - TIME_RANGE_MS[timeRange];

  const filtered = history.filter(
    (h) => new Date(h.timestamp).getTime() >= cutoff
  );

  const chartData = filtered.map((h) => ({
    time: new Date(h.timestamp).getTime(),
    price: h.stocks[activeStock]?.estimatedPrice ?? null,
    changeRate: h.stocks[activeStock]?.changeRate ?? null,
  }));

  const baseline = krxClose?.[activeStock];

  const formatAxisTime = (v: number): string => {
    const d = new Date(v);
    if (timeRange === "7d") {
      return new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric",
      }).format(d);
    }
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  };

  const formatTooltipTime = (v: number): string =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(v));

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface-1 p-5 md:p-6 animate-slide-fade-in">
      <ChartHeader
        activeStock={activeStock}
        timeRange={timeRange}
        onStockChange={setSelectedStock}
        onRangeChange={onRangeChange}
        showStockSelector={stockId === undefined}
      />

      {chartData.length < 2 ? (
        <div className="flex flex-col items-center justify-center h-52 mt-4 gap-3">
          <div className="w-10 h-10 rounded-full border border-[var(--border-subtle)] flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 12 L5 8 L8 10 L11 5 L14 7"
                stroke="#6f7a8c"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {isLoading
                ? "가격 추이를 불러오는 중입니다."
                : "표시할 가격 추이가 없습니다."}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {isLoading
                ? "잠시만 기다려주세요."
                : "네트워크 상태를 확인한 뒤 다시 시도해주세요."}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={plotRef}
          className="h-56 mt-4"
          role="img"
          aria-label={`${STOCK_LABELS[activeStock]} 가격 추이 차트`}
        >
          {plotWidth > 0 && (
            <ChartPlot
              points={chartData}
              width={plotWidth}
              height={224}
              baseline={baseline}
              formatAxisTime={formatAxisTime}
              formatTooltipTime={formatTooltipTime}
              gradientId={gradientId}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ChartHeader({
  activeStock,
  timeRange,
  onStockChange,
  onRangeChange,
  showStockSelector,
}: {
  activeStock: StockId;
  timeRange: TimeRange;
  onStockChange: (s: StockId) => void;
  onRangeChange: (r: TimeRange) => void;
  showStockSelector: boolean;
}) {
  return (
    /* Pinned charts put a title where the selector would be, so both states
       space out the same way. */
    <div className="flex flex-wrap items-center justify-between gap-2">
      {/* Pinned to one stock: name it, because the selector that would otherwise
          say which one is gone. */}
      {!showStockSelector && (
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {STOCK_LABELS[activeStock]} 가격 추이
        </h3>
      )}

      {/* Stock selector — absent when the chart is pinned to one card's stock */}
      {showStockSelector && (
        <div className="flex gap-1" role="group" aria-label="종목 선택">
          {STOCK_IDS.map((id) => (
            <button
              key={id}
              onClick={() => onStockChange(id)}
              aria-label={`${STOCK_LABELS[id]} 차트 보기`}
              aria-pressed={activeStock === id}
              /* The before: halo lifts the hit box to §19's 44px while the
                 painted chip keeps its 36px — the PILL_QUIET trade from
                 controls.ts, made invisible because these chips are filled at
                 rest. Vertical only, so a chip cannot take its neighbour's tap;
                 wrapped rows sit 8px apart, which two 4px halos just touch. */
              className={`min-h-[36px] relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                activeStock === id
                  ? "bg-[#8b7cff] text-white"
                  : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {STOCK_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-0.5" role="group" aria-label="기간 선택">
        {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            aria-label={`${RANGE_LABELS[r]} 기간 보기`}
            aria-pressed={timeRange === r}
            /*
             * Theme tokens, not the dark palette spelled out.
             *
             * The selected chip was `bg-[rgba(255,255,255,0.08)]` with
             * `text-[#f4f7fb]` — near-white text on a near-white wash, which is
             * legible on the dark card it was designed against and invisible on
             * the light one. The violet tint also matches how the rest of the
             * site marks a current choice.
             */
            /* Same 44px before: halo as the stock chips above (§19). */
            className={`min-h-[36px] relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] px-2.5 py-1 rounded-lg text-xs transition-colors duration-150 ${
              timeRange === r
                ? "bg-[rgba(139,124,255,0.16)] text-[#8b7cff] font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
