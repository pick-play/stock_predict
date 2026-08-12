import { useState } from "react";
import { useMarketData } from "../hooks/useMarketData";
import { useChartHistory } from "../hooks/useChartHistory";
import { AppHeader } from "../components/common/AppHeader";
import { StockEstimateCard } from "../components/dashboard/StockEstimateCard";
import { HeroSummary } from "../components/dashboard/HeroSummary";
import { LazyPriceChart } from "../components/dashboard/LazyPriceChart";
import { MarketIndexGrid } from "../components/dashboard/MarketIndexGrid";
import { EconomicCalendar } from "../components/dashboard/EconomicCalendar";
import { Disclaimer } from "../components/common/Disclaimer";
import { RecentChatStrip } from "../components/dashboard/RecentChatStrip";
import { CommunityHotList } from "../components/dashboard/CommunityHotList";
import { ErrorState } from "../components/common/ErrorState";
import { StockCardSkeleton } from "../components/common/LoadingSkeleton";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { MobileBottomBar } from "../components/layout/MobileBottomBar";
import type { StockId } from "../types/market";
import type { ChartRange, StockAnchor } from "../lib/binance/klineHistory";

const STOCK_IDS: StockId[] = ["samsung", "skHynix"];

/**
 * Both cards' buttons point at the same panel, because there is only one.
 * A constant rather than useId: the id has to be stable across the two cards.
 */
const CHART_PANEL_ID = "stock-chart-panel";

interface DashboardPageProps {
  onNavigateBoard?: () => void;
  onNavigateChat?: () => void;
}

export function DashboardPage({
  onNavigateBoard,
  onNavigateChat,
}: DashboardPageProps) {
  const { stocks, lastUpdated, error, isLoading, usingFallback, wsStatus } =
    useMarketData();

  const [chartRange, setChartRange] = useState<ChartRange>("24h");
  /**
   * Which card's chart is open, or null.
   *
   * One chart for both cards, rendered below the grid at full width. Inside a
   * card it made the grid row as tall as the chart, which stretched the other
   * card into a large empty box beside it — and a chart is easier to read wide
   * than half-wide anyway.
   */
  const [chartStock, setChartStock] = useState<StockId | null>(null);

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
        onNavigateChat={onNavigateChat}
      />

      <main className="px-4 md:px-6 pb-24 md:pb-10 space-y-4">
        <HeroSummary />

        {/* Chat leads the page by owner decision, on its own at full width. */}
        <RecentChatStrip onNavigateChat={onNavigateChat} />

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
                sparklineData={getSparklineData(id)}
                animationDelay={`${index * 80}ms`}
                wsStatus={wsStatus}
                chartOpen={chartStock === id}
                onToggleChart={() =>
                  setChartStock((open) => (open === id ? null : id))
                }
                chartPanelId={CHART_PANEL_ID}
              />
            );
          })}
        </div>

        {/* The one chart, at full width, for whichever card asked for it. Kept
            unmounted until then so the Recharts chunk stays out of the first
            paint (§22). */}
        {chartStock && (
          <div id={CHART_PANEL_ID} className="animate-fade-in">
            <LazyPriceChart
              history={history}
              krxClose={krxClose}
              range={chartRange}
              onRangeChange={setChartRange}
              isLoading={chartLoading}
              stockId={chartStock}
            />
          </div>
        )}

        {/* Release schedule, then the week's hot community posts under it. Both
            below the chart, because the chart belongs to the cards whose button
            opens it and nothing should sit between a control and what it
            controls. Stacked rather than side by side: the calendar grows when
            전체보기 is pressed, and a neighbour in the same grid row would stretch
            with it into an empty box. */}
        <EconomicCalendar />
        <CommunityHotList onNavigateBoard={onNavigateBoard} />

        {/* Major markets — same feed as the ticker tape, read rather than glanced */}
        <MarketIndexGrid />

        <Disclaimer />
      </main>

      <MobileBottomBar />
    </DashboardLayout>
  );
}
