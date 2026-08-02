import type { StockSnapshot, StockId } from "../../types/market";
import { getDataFreshness } from "../../lib/staleData";
import { formatRelativeTime } from "../../lib/format";
import { CONFIDENCE_THRESHOLDS } from "../../config/theme";
import { useNow } from "../../hooks/useNow";

interface MarketMetricsProps {
  stocks: Partial<Record<StockId, StockSnapshot>>;
  lastUpdated: string | null;
  usingFallback: boolean;
}

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: "데이터 최신",
  warning: "데이터 지연",
  stale: "업데이트 중단",
  unknown: "확인 필요",
};

const FRESHNESS_COLOR: Record<string, string> = {
  fresh: "#31c48d",
  warning: "#f5b942",
  stale: "#ff5d6c",
  unknown: "#6f7a8c",
};

export function MarketMetrics({
  stocks,
  lastUpdated,
  usingFallback,
}: MarketMetricsProps) {
  const now = useNow();
  const stockIds: StockId[] = ["samsung", "skHynix"];
  const entries = stockIds
    .map((id) => ({ id, snapshot: stocks[id] }))
    .filter(
      (e): e is { id: StockId; snapshot: StockSnapshot } => !!e.snapshot
    );

  return (
    <div className="animate-slide-fade-in delay-350 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-surface-1 p-5 md:p-6">
      <h3 className="text-xs font-semibold text-[#6f7a8c] uppercase tracking-widest mb-4">
        데이터 품질
      </h3>

      <div className="space-y-4">
        {entries.map(({ snapshot }) => {
          const freshness = getDataFreshness(snapshot.eventTime);
          const score = snapshot.confidenceScore;
          const scoreColor =
            score >= CONFIDENCE_THRESHOLDS.good
              ? "#31c48d"
              : score >= CONFIDENCE_THRESHOLDS.fair
              ? "#f5b942"
              : "#ff5d6c";
          const freshnessColor = FRESHNESS_COLOR[freshness] ?? "#6f7a8c";
          const freshnessLabel = FRESHNESS_LABEL[freshness] ?? "확인 필요";

          return (
            <div key={snapshot.koreanTicker}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <p className="text-xs font-medium text-[#a6b0c0]">
                    {snapshot.displayName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: freshnessColor }}
                      aria-hidden="true"
                    />
                    <p
                      className="text-[10px]"
                      style={{ color: freshnessColor }}
                    >
                      {freshnessLabel}
                    </p>
                  </div>
                </div>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: scoreColor }}
                  aria-label={`데이터 신뢰도 ${score}점`}
                >
                  {score}
                  <span className="text-[10px] font-normal text-[#4a5568]">
                    /100
                  </span>
                </span>
              </div>

              {/* Per-stock confidence bar */}
              <div className="h-[2px] rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${score}%`, backgroundColor: scoreColor }}
                />
              </div>
            </div>
          );
        })}

        {entries.length === 0 && (
          <p className="text-xs text-[#6f7a8c]">데이터를 불러오는 중입니다.</p>
        )}
      </div>

      {/* Last update footer */}
      {lastUpdated && (
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-4">
          <p className="text-[10px] text-[#4a5568]">
            마지막 갱신:{" "}
            <span className="tabular-nums">
              {formatRelativeTime(lastUpdated, now)}
            </span>
          </p>
          {usingFallback && (
            <p className="text-[10px] text-[#f5b942] mt-1">
              최신 시세 연결이 원활하지 않습니다. 저장 데이터를 표시합니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
