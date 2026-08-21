import { useState } from "react";
import { useMarketData } from "../hooks/useMarketData";
import { useChartHistory } from "../hooks/useChartHistory";
import { AppHeader } from "../components/common/AppHeader";
import { AuthModal } from "../components/board/auth/AuthModal";
import { RecoveryCodeModal } from "../components/board/auth/RecoveryCodeModal";
import { useAuth } from "../hooks/useAuth";
import type { SignupResult } from "../types/board";
import { StockEstimateCard } from "../components/dashboard/StockEstimateCard";
import { InstallButton } from "../components/common/InstallButton";
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

/**
 * Phone stacking order for the cards and the chart between them.
 *
 * Tailwind needs the class names spelled out — it scans source text, so a
 * computed `order-${n}` would never be generated. Odd numbers for the cards,
 * even for the chart slot that follows each one; both are reset to source order
 * at md, where the chart belongs at the bottom across both columns.
 */
const CARD_ORDER = ["order-1 md:order-none", "order-3 md:order-none"];
const CHART_ORDER = ["order-2", "order-4"];

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

  /**
   * 6시간 by default (owner decision, 2026-08-21).
   *
   * The chart opens from a card showing tonight's estimate, and 24h answered a
   * question nobody asked there — it spans the domestic session the site tells
   * readers to ignore. Six hours covers an evening's worth of overseas trading,
   * which is the window the estimate actually moves in.
   */
  const [chartRange, setChartRange] = useState<ChartRange>("6h");
  /**
   * Which card's chart is open, or null.
   *
   * One chart for both cards, rendered below the grid at full width. Inside a
   * card it made the grid row as tall as the chart, which stretched the other
   * card into a large empty box beside it — and a chart is easier to read wide
   * than half-wide anyway.
   */
  /*
   * The dashboard carries the account control now, so it owns the modal too.
   * Signing up from here must still show the recovery code — it is the only way
   * back into an account whose password is lost, and shown exactly once.
   */
  const auth = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState<SignupResult | null>(
    null
  );

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
        auth={auth}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* pt-4 because the hero above is usually absent now: without it the
          chat strip sits flush against the header's border. */}
      {/* The hero above renders nothing most of the time now, so this padding
          is what keeps the first card off the header's border. */}
      <main className="px-4 md:px-6 pt-3.5 md:pt-4 pb-24 md:pb-10 space-y-4">
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

        {/* Stock estimate cards, and the one chart they share.
            Staggered entry; the chart stays unmounted until a card asks for it,
            so the Recharts chunk misses the first paint (§22).

            The chart is a grid child rather than a sibling below the grid, which
            is what lets CSS order place it. On a phone the cards stack, so a
            chart parked after both of them opened under SK하이닉스 when the
            삼성전자 button was the one pressed — the panel was nowhere near the
            control that opened it. Ordering puts it directly under its own card.

            Desktop keeps it last and full width (md:order-none): inside the
            two-column row it would stretch the neighbouring card to the chart's
            height and leave a tall empty box beside it. */}
        {/* items-start: a card that opens 상세보기 grows, and without this the
            other one stretches to match and reads as a half-empty box. Same
            failure the chart caused when it lived inside a card. */}
        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
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
                className={CARD_ORDER[index]}
              />
            );
          })}

          {chartStock && (
            <div
              id={CHART_PANEL_ID}
              className={`animate-fade-in md:col-span-2 md:order-none ${
                CHART_ORDER[STOCK_IDS.indexOf(chartStock)] ?? "order-last"
              }`}
            >
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
        </div>

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

      {/* Phones only, and only where nothing else owns the bottom-right. */}
      <InstallButton />

      {authModalOpen && (
        <AuthModal
          auth={auth}
          onClose={() => setAuthModalOpen(false)}
          onRecoveryCode={(result) => {
            setAuthModalOpen(false);
            setPendingRecovery(result);
          }}
        />
      )}

      {pendingRecovery && (
        <RecoveryCodeModal
          recoveryCode={pendingRecovery.recoveryCode}
          nickname={pendingRecovery.nickname}
          onConfirmed={() => setPendingRecovery(null)}
        />
      )}

      <MobileBottomBar />
    </DashboardLayout>
  );
}
