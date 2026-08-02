import type { StockSnapshot, StockId } from "../../types/market";
import { getDataFreshness } from "../../lib/staleData";
import { formatRelativeTime } from "../../lib/format";
import { CONFIDENCE_THRESHOLDS } from "../../config/theme";

interface MarketMetricsProps {
  stocks: Partial<Record<StockId, StockSnapshot>>;
  lastUpdated: string | null;
  usingFallback: boolean;
}

export function MarketMetrics({ stocks, lastUpdated, usingFallback }: MarketMetricsProps) {
  const stockIds: StockId[] = ["samsung", "skHynix"];
  const entries = stockIds
    .map((id) => ({ id, snapshot: stocks[id] }))
    .filter((e): e is { id: StockId; snapshot: StockSnapshot } => !!e.snapshot);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6">
      <h3 className="text-sm font-semibold text-[#f4f7fb] mb-4">데이터 품질</h3>
      <div className="space-y-3">
        {entries.map(({ snapshot }) => {
          const freshness = getDataFreshness(snapshot.eventTime);
          const score = snapshot.confidenceScore;
          const scoreColor =
            score >= CONFIDENCE_THRESHOLDS.good
              ? "text-[#31c48d]"
              : score >= CONFIDENCE_THRESHOLDS.fair
              ? "text-[#f5b942]"
              : "text-[#ff5d6c]";

          return (
            <div key={snapshot.koreanTicker} className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#a6b0c0]">
                  {snapshot.displayName}
                </p>
                <p className="text-xs text-[#6f7a8c] mt-0.5">
                  {freshness === "fresh"
                    ? "데이터 최신"
                    : freshness === "warning"
                    ? "데이터 지연"
                    : freshness === "stale"
                    ? "업데이트 중단"
                    : "확인 필요"}
                </p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                {score}/100
              </span>
            </div>
          );
        })}
        {lastUpdated && (
          <div className="border-t border-[rgba(255,255,255,0.07)] pt-3">
            <p className="text-xs text-[#6f7a8c]">
              마지막 갱신: {formatRelativeTime(lastUpdated)}
            </p>
            {usingFallback && (
              <p className="text-xs text-[#f5b942] mt-1">
                최신 시세 연결이 원활하지 않습니다. 마지막 정상 데이터로 표시하고 있습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
