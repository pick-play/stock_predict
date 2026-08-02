import { useMarketData } from "../hooks/useMarketData";
import { AppHeader } from "../components/common/AppHeader";
import { StockEstimateCard } from "../components/dashboard/StockEstimateCard";
import { HeroSummary } from "../components/dashboard/HeroSummary";
import { PriceChart } from "../components/dashboard/PriceChart";
import { PriceBreakdown } from "../components/dashboard/PriceBreakdown";
import { MarketMetrics } from "../components/dashboard/MarketMetrics";
import { Disclaimer } from "../components/common/Disclaimer";
import { ErrorState } from "../components/common/ErrorState";
import { StockCardSkeleton } from "../components/common/LoadingSkeleton";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { MobileBottomBar } from "../components/layout/MobileBottomBar";
import type { StockId } from "../types/market";

const STOCK_IDS: StockId[] = ["samsung", "skHynix"];

export function DashboardPage() {
  const { stocks, lastUpdated, error, isLoading, usingFallback } = useMarketData();

  const hasAnyData = STOCK_IDS.some((id) => stocks[id] !== undefined);

  return (
    <DashboardLayout>
      <AppHeader
        isLoading={isLoading}
        usingFallback={usingFallback}
        lastUpdated={lastUpdated}
      />

      <main className="px-4 md:px-6 pb-24 md:pb-8 space-y-4">
        <HeroSummary />

        {error && !hasAnyData && (
          <ErrorState
            message="데이터를 불러올 수 없습니다."
            detail={error}
          />
        )}

        {error && hasAnyData && (
          <ErrorState
            message="최신 시세 연결이 원활하지 않습니다."
            detail="마지막 정상 데이터로 표시하고 있습니다."
          />
        )}

        {/* Stock Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STOCK_IDS.map((id) => {
            const snapshot = stocks[id];
            if (isLoading && !snapshot) {
              return <StockCardSkeleton key={id} />;
            }
            if (!snapshot) return null;
            return <StockEstimateCard key={id} snapshot={snapshot} />;
          })}
        </div>

        {/* Chart */}
        <PriceChart history={[]} />

        {/* Bottom panels */}
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
