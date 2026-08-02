import { useState, useEffect } from "react";
import { useMarketData } from "../hooks/useMarketData";
import { AppHeader } from "../components/common/AppHeader";
import { StockEstimateCard } from "../components/dashboard/StockEstimateCard";
import { HeroSummary } from "../components/dashboard/HeroSummary";
import { LazyPriceChart } from "../components/dashboard/LazyPriceChart";
import { PriceBreakdown } from "../components/dashboard/PriceBreakdown";
import { MarketMetrics } from "../components/dashboard/MarketMetrics";
import { Disclaimer } from "../components/common/Disclaimer";
import { ErrorState } from "../components/common/ErrorState";
import { StockCardSkeleton } from "../components/common/LoadingSkeleton";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { MobileBottomBar } from "../components/layout/MobileBottomBar";
import type { HistoryEntry, StockId } from "../types/market";
import { HISTORY_PATH } from "../config/market";

const STOCK_IDS: StockId[] = ["samsung", "skHynix"];

export function DashboardPage() {
  const { stocks, lastUpdated, error, isLoading, usingFallback } =
    useMarketData();

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history once on mount for sparklines and chart
  useEffect(() => {
    fetch(`${HISTORY_PATH}?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setHistory(data as HistoryEntry[]);
        }
      })
      .catch(() => {
        // history is optional; silently ignore
      });
  }, []);

  const hasAnyData = STOCK_IDS.some((id) => stocks[id] !== undefined);

  // Collect krxClose for chart reference lines
  const krxClose: Partial<Record<StockId, number>> = {};
  for (const id of STOCK_IDS) {
    const s = stocks[id];
    if (s && s.krxClose > 0) krxClose[id] = s.krxClose;
  }

  // Last 24 data points per stock for sparklines
  const getSparklineData = (id: StockId): number[] =>
    history
      .slice(-24)
      .map((h) => h.stocks[id]?.estimatedPrice ?? null)
      .filter((p): p is number => p !== null);

  return (
    <DashboardLayout>
      <AppHeader
        isLoading={isLoading}
        usingFallback={usingFallback}
        lastUpdated={lastUpdated}
      />

      <main className="px-4 md:px-6 pb-24 md:pb-10 space-y-4">
        <HeroSummary />

        {/* Error banners */}
        {error && !hasAnyData && (
          <div className="animate-slide-fade-in">
            <ErrorState
              message="데이터를 불러올 수 없습니다."
              detail={error}
            />
          </div>
        )}
        {error && hasAnyData && (
          <div className="animate-slide-fade-in">
            <ErrorState
              message="최신 시세 연결이 원활하지 않습니다."
              detail="마지막 정상 데이터로 표시하고 있습니다."
            />
          </div>
        )}

        {/* Stock estimate cards — staggered entry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STOCK_IDS.map((id, index) => {
            const snapshot = stocks[id];
            if (isLoading && !snapshot) {
              return <StockCardSkeleton key={id} />;
            }
            if (!snapshot) return null;
            return (
              <StockEstimateCard
                key={id}
                snapshot={snapshot}
                sparklineData={getSparklineData(id)}
                animationDelay={`${index * 80}ms`}
              />
            );
          })}
        </div>

        {/* Price chart — lazy-loaded to split Recharts from initial bundle */}
        <LazyPriceChart history={history} krxClose={krxClose} />

        {/* Bottom detail panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PriceBreakdown stocks={stocks} />
          <MarketMetrics
            stocks={stocks}
            lastUpdated={lastUpdated}
            usingFallback={usingFallback}
          />
        </div>

        <Disclaimer />
      </main>

      <MobileBottomBar lastUpdated={lastUpdated} isLoading={isLoading} />
    </DashboardLayout>
  );
}
