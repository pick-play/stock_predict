import { useState, useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { HistoryEntry, StockId } from "../../types/market";
import type { ChartRange } from "../../lib/binance/klineHistory";
import { formatKrw, formatPercent } from "../../lib/format";

interface PriceChartProps {
  history: HistoryEntry[];
  krxClose?: Partial<Record<StockId, number>>;
  /** Owned by the page: the range decides which candles are fetched. */
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  isLoading?: boolean;
  /**
   * Pins the chart to one stock and drops the stock selector.
   *
   * Set when the chart lives inside a stock's own card, where a selector that
   * could switch to the other company would contradict the card around it.
   */
  stockId?: StockId;
  /** Drops the card chrome, for when a card already provides it. */
  embedded?: boolean;
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

const STOCK_LABELS: Record<StockId, string> = {
  samsung: "삼성전자",
  skHynix: "SK하이닉스",
};

export function PriceChart({
  history,
  krxClose,
  range,
  onRangeChange,
  isLoading = false,
  stockId,
  embedded = false,
}: PriceChartProps) {
  const [selectedStock, setSelectedStock] = useState<StockId>("samsung");
  // A pinned stock overrides the selector's state rather than syncing to it, so
  // the embedded chart cannot drift from the card it belongs to.
  const activeStock = stockId ?? selectedStock;
  const timeRange = range;
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const gradientId = `pg-${uid}`;

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
    <div
      className={
        embedded
          ? ""
          : "rounded-2xl border border-[rgba(255,255,255,0.07)] bg-surface-1 p-5 md:p-6 animate-slide-fade-in delay-250"
      }
    >
      <ChartHeader
        activeStock={activeStock}
        timeRange={timeRange}
        onStockChange={setSelectedStock}
        onRangeChange={onRangeChange}
        showStockSelector={stockId === undefined}
      />

      {chartData.length < 2 ? (
        <div className="flex flex-col items-center justify-center h-52 mt-4 gap-3">
          <div className="w-10 h-10 rounded-full border border-[rgba(255,255,255,0.07)] flex items-center justify-center">
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
            <p className="text-sm text-[#a6b0c0]">
              {isLoading
                ? "가격 추이를 불러오는 중입니다."
                : "표시할 가격 추이가 없습니다."}
            </p>
            <p className="text-xs text-[#6f7a8c] mt-1">
              {isLoading
                ? "잠시만 기다려주세요."
                : "네트워크 상태를 확인한 뒤 다시 시도해주세요."}
            </p>
          </div>
        </div>
      ) : (
        <div className="h-56 mt-4" role="img" aria-label={`${STOCK_LABELS[activeStock]} 가격 추이 차트`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b7cff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b7cff" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatAxisTime}
                tick={{
                  fill: "#6f7a8c",
                  fontSize: 10,
                  fontFamily:
                    "Pretendard, 'Noto Sans KR', -apple-system, sans-serif",
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
              />

              <YAxis
                dataKey="price"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat("ko-KR").format(Math.round(v))
                }
                tick={{
                  fill: "#6f7a8c",
                  fontSize: 10,
                  fontFamily:
                    "Pretendard, 'Noto Sans KR', -apple-system, sans-serif",
                }}
                axisLine={false}
                tickLine={false}
                width={70}
              />

              {baseline !== undefined && (
                <ReferenceLine
                  y={baseline}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="5 4"
                  label={{
                    value: "종가",
                    position: "insideTopRight",
                    fill: "#6f7a8c",
                    fontSize: 9,
                  }}
                />
              )}

              <Tooltip
                contentStyle={{
                  background: "#121824",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#f4f7fb",
                  padding: "10px 14px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
                labelStyle={{
                  color: "#6f7a8c",
                  fontSize: "10px",
                  marginBottom: "6px",
                  display: "block",
                }}
                cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : 0;
                  if (name === "price") return [formatKrw(v), "예상가격"];
                  if (name === "changeRate") return [formatPercent(v), "야간변동"];
                  return [String(value), String(name)];
                }}
                labelFormatter={(label) =>
                  formatTooltipTime(
                    typeof label === "number" ? label : 0
                  )
                }
              />

              <Area
                type="monotone"
                dataKey="price"
                stroke="#8b7cff"
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#8b7cff",
                  stroke: "#121824",
                  strokeWidth: 2,
                }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
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
    <div
      className={`flex flex-wrap items-center gap-2 ${
        showStockSelector ? "justify-between" : "justify-end"
      }`}
    >
      {/* Stock selector — absent when the chart is pinned to one card's stock */}
      {showStockSelector && (
        <div className="flex gap-1" role="group" aria-label="종목 선택">
          {(["samsung", "skHynix"] as StockId[]).map((id) => (
            <button
              key={id}
              onClick={() => onStockChange(id)}
              aria-label={`${STOCK_LABELS[id]} 차트 보기`}
              aria-pressed={activeStock === id}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                activeStock === id
                  ? "bg-[#8b7cff] text-white"
                  : "bg-surface-3 text-[#a6b0c0] hover:text-[#f4f7fb] hover:bg-[rgba(255,255,255,0.06)]"
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
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs transition-all duration-150 ${
              timeRange === r
                ? "bg-[rgba(255,255,255,0.08)] text-[#f4f7fb]"
                : "text-[#6f7a8c] hover:text-[#a6b0c0]"
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
