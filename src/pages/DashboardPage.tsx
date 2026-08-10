import { useState } from "react";
import { useMarketData } from "../hooks/useMarketData";
import { useChartHistory } from "../hooks/useChartHistory";
import { AppHeader } from "../components/common/AppHeader";
import { StockEstimateCard } from "../components/dashboard/StockEstimateCard";
import { HeroSummary } from "../components/dashboard/HeroSummary";
import { MarketIndexGrid } from "../components/dashboard/MarketIndexGrid";
import { Disclaimer } from "../components/common/Disclaimer";
import { PopularTicker } from "../components/board/PopularTicker";
import { ErrorState } from "../components/common/ErrorState";
import { StockCardSkeleton } from "../components/common/LoadingSkeleton";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { MobileBottomBar } from "../components/layout/MobileBottomBar";
import type { StockId } from "../types/market";
import type { ChartRange, StockAnchor } from "../lib/binance/klineHistory";

const STOCK_IDS: StockId[] = ["samsung", "skHynix"];

interface DashboardPageProps {
  onNavigateBoard?: () => void;
}

export function DashboardPage({ onNavigateBoard }: DashboardPageProps) {
  const { stocks, lastUpdated, error, isLoading, usingFallback, anchor, wsStatus } =
    useMarketData();

  const [chartRange, setChartRange] = useState<ChartRange>("24h");

  // The candles are converted with the same anchor the cards are priced from,
  // so the chart and the headline number always agree.
  const anchors: Partial<Record<StockId, StockAnchor>> = {};
  for (const id of STOCK_IDS) {
    const s = stocks[id];
    if (s && s.krxClose > 0 && s.baselineBinancePrice > 0) {
      anchors[id] = {
        krxPrice: s.krxClose,
        anchorFuturesPrice: s.baselineBinancePrice,
      };
    }
  }

  const { history, isLoading: chartLoading } = useChartHistory(
    chartRange,
    anchors
  );

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
        wsStatus={wsStatus}
        onNavigateBoard={onNavigateBoard}
      />

      <main className="px-4 md:px-6 pb-24 md:pb-10 space-y-4">
        <HeroSummary anchor={anchor} />

        {/* Community ticker — calm secondary strip, only visible when board is live */}
        <PopularTicker />

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

        {/* Stock estimate cards — staggered entry. Each owns its own chart,
            collapsed until asked for, so Recharts stays out of the first paint. */}
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
                stockId={id}
                sparklineData={getSparklineData(id)}
                animationDelay={`${index * 80}ms`}
                wsStatus={wsStatus}
                history={history}
                krxClose={krxClose}
                chartRange={chartRange}
                onChartRangeChange={setChartRange}
                chartLoading={chartLoading}
              />
            );
          })}
        </div>

        {/* Major markets — same feed as the ticker tape, read rather than glanced */}
        <MarketIndexGrid />

        <Disclaimer />
      </main>

      <MobileBottomBar />
    </DashboardLayout>
  );
}
