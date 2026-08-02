import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { HistoryEntry, StockId } from "../../types/market";
import { formatKrw, formatPercent } from "../../lib/format";

interface PriceChartProps {
  history: HistoryEntry[];
  krxClose?: Record<StockId, number>;
}

type TimeRange = "1h" | "6h" | "24h" | "7d";

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

export function PriceChart({ history, krxClose }: PriceChartProps) {
  const [activeStock, setActiveStock] = useState<StockId>("samsung");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

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

  if (chartData.length < 2) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6">
        <ChartHeader
          activeStock={activeStock}
          timeRange={timeRange}
          onStockChange={setActiveStock}
          onRangeChange={setTimeRange}
        />
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-sm text-[#a6b0c0]">가격 이력을 수집하고 있습니다.</p>
          <p className="text-xs text-[#6f7a8c] mt-1">
            데이터가 쌓이면 추이 차트가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6">
      <ChartHeader
        activeStock={activeStock}
        timeRange={timeRange}
        onStockChange={setActiveStock}
        onRangeChange={setTimeRange}
      />
      <div className="h-52 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => {
                const d = new Date(v);
                return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
              }}
              tick={{ fill: "#6f7a8c", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="price"
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
              tick={{ fill: "#6f7a8c", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            {baseline !== undefined && (
              <ReferenceLine
                y={baseline}
                stroke="rgba(255,255,255,0.2)"
                strokeDasharray="4 4"
              />
            )}
            <Tooltip
              contentStyle={{
                background: "#121824",
                border: "1px solid rgba(255,255,255,0.13)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f4f7fb",
              }}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : 0;
                if (name === "price") return [formatKrw(v), "예상가격"];
                return [formatPercent(v), "야간변동"];
              }}
              labelFormatter={(label) => {
                const d = new Date(typeof label === "number" ? label : 0);
                return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#8b7cff"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartHeader({
  activeStock,
  timeRange,
  onStockChange,
  onRangeChange,
}: {
  activeStock: StockId;
  timeRange: TimeRange;
  onStockChange: (s: StockId) => void;
  onRangeChange: (r: TimeRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1">
        {(["samsung", "skHynix"] as StockId[]).map((id) => (
          <button
            key={id}
            onClick={() => onStockChange(id)}
            aria-label={id === "samsung" ? "삼성전자 차트 보기" : "SK하이닉스 차트 보기"}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeStock === id
                ? "bg-[#8b7cff] text-white"
                : "bg-[#18202e] text-[#a6b0c0] hover:text-[#f4f7fb]"
            }`}
          >
            {id === "samsung" ? "삼성전자" : "SK하이닉스"}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            aria-label={`${RANGE_LABELS[r]} 기간 보기`}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
              timeRange === r
                ? "bg-[#18202e] text-[#f4f7fb]"
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
