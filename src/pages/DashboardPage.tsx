import { useCallback, useMemo, useState } from "react";
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
import { ChatLauncher } from "../components/chat/ChatLauncher";
import { CommunityHotList } from "../components/dashboard/CommunityHotList";
import { ErrorState } from "../components/common/ErrorState";
import { StockCardSkeleton } from "../components/common/LoadingSkeleton";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { MobileBottomBar } from "../components/layout/MobileBottomBar";
import { STOCK_IDS } from "../config/symbols";
import type { StockId } from "../types/market";
import type { ChartRange, StockAnchor } from "../lib/binance/klineHistory";

/**
 * Both cards' buttons point at the same panel, because there is only one.
 * A constant rather than useId: the id has to be stable across the two cards.
 */
const CHART_PANEL_ID = "stock-chart-panel";

/**
 * Where the chart lands: directly under the ROW that opened it.
 *
 * A row is one card on a phone and two from `md` up, so every element carries
 * two orders — the phone's and the desktop's. Cards sharing a row share an odd
 * order (equal orders keep DOM order between them) and the chart takes the even
 * value after it. Opening 한미반도체 therefore drops the chart under its own row
 * rather than at the foot of a list of seven.
 *
 * Spelled out, because Tailwind scans source text: a computed `order-${n}`
 * generates no CSS at all. Seven phone rows need orders 1-14, past the default
 * 1-12 scale, so the tail uses arbitrary values — still literal text.
 */
const PHONE_ROW_ORDER = [
  "order-1",
  "order-[11]",
  "order-[21]",
  "order-[31]",
  "order-[41]",
  "order-[51]",
  "order-[61]",
];
const PHONE_CHART_ORDER = [
  "order-2",
  "order-[12]",
  "order-[22]",
  "order-[32]",
  "order-[42]",
  "order-[52]",
  "order-[62]",
];
const ROW_ORDER = [
  "md:order-1",
  "md:order-[11]",
  "md:order-[21]",
  "md:order-[31]",
];
const CHART_ROW_ORDER = [
  "md:order-2",
  "md:order-[12]",
  "md:order-[22]",
  "md:order-[32]",
];

/**
 * The chat strip's slot: under SK하이닉스, not under the last listing.
 *
 * Owner decision, 2026-08-22. The two majors are what most readers came for, so
 * the room sits directly under them rather than below all seven — near enough
 * to be seen, far enough that a conversation is not the first thing on the
 * page.
 *
 * A row is one card on a phone and two on a desktop, so "after the first row"
 * is a different position on each: after 하이닉스 and its chart slot (12) on a
 * phone, after the first pair's chart slot (2) on a desktop.
 */
const STRIP_ORDER = "order-[15] md:order-[5]";

/**
 * One per row on a phone, two from `md` up.
 *
 * Two columns everywhere was tried and reverted (owner decision, 2026-08-22):
 * on a 375px screen each card was about 165px, so nothing inside could wrap —
 * the price, the name and the buttons all shrank to fit instead of the cards
 * flowing down the page. A phone has one column of room; the second column was
 * taken out of the numbers.
 */
const CARDS_PER_ROW = 2;

/**
 * The entry stagger, as constants.
 *
 * A template literal rebuilt each render is a new string only in the sense that
 * matters here — it is fine for equality, but writing it out keeps every prop
 * on the card obviously stable at a glance, which is the property the memo
 * depends on. Capped at six steps so the seventh card does not open late.
 */
const ANIMATION_DELAY = ["0ms", "60ms", "120ms", "180ms", "240ms", "300ms"];

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
   * 24시간 by default (owner decision, 2026-08-22).
   *
   * This was six hours for a day, on the argument that a full day drags in the
   * domestic session the site tells readers to ignore. It does — and a reader
   * opening a chart still wants to see where the day started, not the tail of
   * an evening. The regular-hours stretch is context for the overnight move,
   * not a distraction from it.
   */
  const [chartRange, setChartRange] = useState<ChartRange>("24h");
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

  /*
   * The whole series behind each card's corner chart — not a tail of it.
   *
   * This was capped at the last 24 points, which was right for an 88×30
   * thumbnail and wrong the moment the picture got bigger: at the default 6-hour
   * range those 24 five-minute candles are two hours, so the card drew a coarse
   * two-hour line in a space that reads as a chart. Handing over the full range
   * gives the same window the chart below shows, at the resolution it was
   * fetched with.
   *
   * Built once per history change rather than per render, and the arrays are
   * kept — a new array on every render defeats the memo on the card, and prices
   * arrive about once a second. See the note on StockEstimateCard.
   */
  const sparklines = useMemo(() => {
    const byStock = {} as Record<StockId, number[]>;
    for (const id of STOCK_IDS) {
      byStock[id] = history
        .map((h) => h.stocks[id]?.estimatedPrice ?? null)
        .filter((p): p is number => p !== null);
    }
    return byStock;
  }, [history]);

  /*
   * One handler for all seven cards, keyed by the id it is called with.
   *
   * An inline `() => setChartStock(...)` per card is a new function on every
   * render, which is the other half of what would keep React.memo from ever
   * skipping a card.
   */
  const toggleChart = useCallback((id: StockId) => {
    setChartStock((open) => (open === id ? null : id));
  }, []);

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
            The chart stays unmounted until a card asks for it, so the Recharts
            chunk misses the first paint (§22). It is a grid child rather than a
            sibling below the grid, which is what lets CSS order drop it under
            the row whose button opened it — parked at the end it would sit as
            much as three rows away from the card that asked for it.

            items-start: a card that opens 상세보기 grows, and without this its
            neighbour stretches to match and reads as a half-empty box. */}
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 md:gap-4">
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
                sparklineData={sparklines[id]}
                animationDelay={ANIMATION_DELAY[Math.min(index, 5)]}
                wsStatus={wsStatus}
                chartOpen={chartStock === id}
                stockId={id}
                onToggleChart={toggleChart}
                chartPanelId={CHART_PANEL_ID}
                className={`${PHONE_ROW_ORDER[index] ?? "order-last"} ${
                  ROW_ORDER[Math.floor(index / CARDS_PER_ROW)] ?? "md:order-last"
                }`}
              />
            );
          })}

          {/*
            The room, in the grid so CSS order can put it under the first row.
            
            It led the page until 2026-08-22; on a phone that put a conversation
            where the prices should be. The launcher in the corner is the way in
            now, so this is a preview of what is being said.
          */}
          <div className={`md:col-span-2 ${STRIP_ORDER}`}>
            <RecentChatStrip onNavigateChat={onNavigateChat} />
          </div>

          {chartStock && (
            <div
              id={CHART_PANEL_ID}
              className={`animate-fade-in md:col-span-2 ${
                PHONE_CHART_ORDER[STOCK_IDS.indexOf(chartStock)] ?? "order-last"
              } ${
                CHART_ROW_ORDER[
                  Math.floor(STOCK_IDS.indexOf(chartStock) / CARDS_PER_ROW)
                ] ?? "md:order-last"
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

      {/* Both live in the bottom-right corner; the install button stacks above
          the launcher, which is the one people press. */}
      <ChatLauncher onExpand={onNavigateChat} />
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
