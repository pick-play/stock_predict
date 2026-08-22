import { memo, useEffect, useRef, useState } from "react";
import { useNow } from "../../hooks/useNow";
import type { StockId, StockSnapshot } from "../../types/market";
import {
  formatKrw,
  formatPercent,
  formatChangeAmount,
  formatDirectionSymbol,
  getDirection,
  formatBinancePrice,
} from "../../lib/format";
import { getLastKrxCloseMs, getSeoulDate } from "../../lib/koreaMarket";
import { getDataFreshness } from "../../lib/staleData";
import { Sparkline } from "./Sparkline";
import { StockLogo } from "./StockLogo";
import { ShareCardButton } from "./ShareCardButton";
import type { WsConnectionStatus } from "../../lib/binance/websocketAdapter";
import { BRAND_NAME } from "../../config/brand";

/**
 * How often the card re-evaluates whether its price is still fresh.
 *
 * The thresholds it feeds are minutes apart (see staleData), so a finer clock
 * would only buy re-renders.
 */
const FRESHNESS_TICK_MS = 30_000;

/**
 * The card's three actions: 차트 보기 · 상세보기 · 공유하기.
 *
 * One class, and a three-column grid rather than a left-aligned row with the
 * share button pushed to the far edge. Equal widths make them read as one
 * control instead of two things and a stray, and a full-width band gives the
 * card a base — the bottom looked unfinished with a short row floating above
 * whitespace.
 *
 * Small on purpose: they are ways to ask for more, not the point of the card.
 */
const ACTION_CLASS = [
  "inline-flex h-8 w-full items-center justify-center gap-1",
  "rounded-lg text-[0.6875rem] font-medium",
  "bg-[var(--surface-2)] text-[var(--text-tertiary)]",
  "transition-colors duration-150 active:scale-[0.97] motion-reduce:active:scale-100",
  "hover:bg-[var(--surface-3)] hover:text-[var(--text-secondary)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]",
  "disabled:opacity-50 disabled:active:scale-100",
].join(" ");

interface StockEstimateCardProps {
  snapshot: StockSnapshot;
  sparklineData?: number[];
  animationDelay?: string;
  /** Live-stream state, which decides whether this card may say 실시간. */
  wsStatus?: WsConnectionStatus;
  /** Which listing this card is, so the shared toggle knows who called it. */
  stockId: StockId;
  /** Whether this card's chart is the one currently open below the grid. */
  chartOpen: boolean;
  /**
   * Shared by every card and called with this card's id.
   *
   * One stable function rather than a closure per card: an inline arrow is a
   * new prop on every render of the page, which would make the memo below a
   * no-op.
   */
  onToggleChart: (id: StockId) => void;
  /** Ties the button to the panel the page renders. */
  chartPanelId: string;
  /** Grid placement from the page — the phone stacking order. */
  className?: string;
}

function StockEstimateCardImpl({
  snapshot,
  stockId,
  sparklineData,
  animationDelay,
  wsStatus,
  chartOpen,
  onToggleChart,
  chartPanelId,
  className = "",
}: StockEstimateCardProps) {
  /*
   * Minutes, not seconds. The only thing the card body derives from the clock is
   * the freshness state, whose thresholds are 5 and 15 minutes; subscribing at
   * one second re-rendered the whole card — price, sparkline, metric table —
   * sixty times a minute. The seconds readout in the footer keeps its own
   * one-second clock inside a leaf, where a tick repaints one text node.
   */
  useNow(FRESHNESS_TICK_MS);

  /**
   * The calculation rows, collapsed.
   *
   * Card-local rather than lifted to the page like the chart: these rows are
   * short and sit inside the card, so opening one does not stretch the grid row
   * and leave the neighbouring card as a tall empty box — which is exactly what
   * the chart did before it was moved out.
   */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsPanelId = `stock-details-${snapshot.koreanTicker}`;
  const direction = getDirection(snapshot.changeRate);
  const dirSymbol = formatDirectionSymbol(snapshot.changeRate);
  const isNoBaseline = snapshot.status === "no-baseline";
  /* Two points is the minimum that describes a direction; one is a dot (§12). */
  const hasTrend = !!sparklineData && sparklineData.length >= 2;

  // Price flash: increment key to force animation restart without DOM flicker
  const prevPriceRef = useRef(snapshot.estimatedPrice);
  const [flashKey, setFlashKey] = useState(0);
  const [flashDir, setFlashDir] = useState<"rise" | "fall" | null>(null);

  useEffect(() => {
    const prev = prevPriceRef.current;
    const curr = snapshot.estimatedPrice;
    // Only flash when going between real prices (not from zero on initial load)
    if (prev !== curr && prev > 0 && curr > 0) {
      setFlashDir(curr > prev ? "rise" : "fall");
      setFlashKey((k) => k + 1);
    }
    prevPriceRef.current = curr;
  }, [snapshot.estimatedPrice]);

  // Directional color tokens
  const dirColor =
    direction === "rise"
      ? "text-[#ff4d5e]"
      : direction === "fall"
      ? "text-[#3f82ff]"
      : "text-[#d6dde8]";

  const accentColor =
    direction === "rise"
      ? "#ff4d5e"
      : direction === "fall"
      ? "#3f82ff"
      : "rgba(214,221,232,0.15)";

  /**
   * What the footer now says instead of a confidence score.
   *
   * 실시간 is claimed only when the price socket is actually connected and the
   * last tick is recent — this card really is repriced from a live order book
   * once a second, so the word is earned. The moment either condition fails it
   * degrades rather than keeping a green light on a frozen number.
   */
  const freshness = getDataFreshness(snapshot.eventTime);
  const liveState: "live" | "delayed" | "stalled" | "reconnecting" =
    wsStatus !== undefined && wsStatus !== "connected"
      ? "reconnecting"
      : freshness === "fresh"
      ? "live"
      : freshness === "warning"
      ? "delayed"
      : "stalled";

  const LIVE_PRESENTATION = {
    live: { label: "실시간", color: "#31c48d", pulse: true },
    delayed: { label: "갱신 지연", color: "#f5b942", pulse: false },
    stalled: { label: "업데이트 중단", color: "#ff5d6c", pulse: false },
    reconnecting: { label: "연결 재시도 중", color: "#f5b942", pulse: true },
  } as const;
  const live = LIVE_PRESENTATION[liveState];

  const spreadLabel =
    snapshot.spreadPercent !== null
      ? `${snapshot.spreadPercent.toFixed(4)}%`
      : "—";

  // Which KRX price the estimate is measured from: today's open while the
  // market is trading, the last close otherwise.
  const anchorKind = snapshot.anchorKind ?? "close";
  const anchorKindLabel = anchorKind === "open" ? "시가" : "종가";
  const anchorSeoul = getSeoulDate(
    snapshot.anchorMarketDate
      ? new Date(`${snapshot.anchorMarketDate}T00:00:00+09:00`)
      : new Date(getLastKrxCloseMs())
  );
  const anchorDate = `${String(anchorSeoul.month).padStart(2, "0")}/${String(anchorSeoul.day).padStart(2, "0")}`;
  const anchorLabel = `기준가 (${anchorDate} ${anchorKindLabel})`;
  const krxAnchorLabel =
    anchorKind === "open" ? `국내 시가 (${anchorDate})` : `최근 국내 종가 (${anchorDate})`;

  const flashClass =
    flashKey > 0 && flashDir !== null
      ? flashDir === "rise"
        ? "animate-flash-rise"
        : "animate-flash-fall"
      : "";

  return (
    <article
      className={`animate-slide-fade-in relative rounded-2xl border border-[var(--border-subtle)] bg-surface-1 overflow-hidden hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-xl hover:shadow-black/20 transition-all duration-200 ease-out ${className}`}
      style={{ animationDelay, willChange: "transform" }}
      aria-label={`${snapshot.displayName} 예상가격 카드`}
    >
      {/* Directional accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />

      <div className="px-3.5 pt-4 pb-2.5 md:px-6 md:pt-6 md:pb-3.5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            {/* The name reads first. It was 14px, the same size as a metric
                label, in a card whose whole subject it is.

                The wordmark sits to its right (owner decision) and is allowed
                to shrink or vanish before the name does: the name is the thing
                that has to survive a narrow card. A listing with no file just
                shows its name. */}
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="truncate text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-none">
                {snapshot.displayName}
              </h2>
              <StockLogo koreanTicker={snapshot.koreanTicker} />
            </div>
            {/* The ticker identifies, it does not announce: no chip, no fill. */}
            <span className="mt-1 block text-[0.6875rem] font-mono text-[var(--text-muted)]">
              {snapshot.koreanTicker}
            </span>
          </div>
          {/* The shape of the last hours, tinted by the change printed below
              it. A full-width picture behind the price was tried and reverted
              (owner decision) — this is small enough to be read as a hint at
              the header's edge rather than as a chart the card is about. */}
          {hasTrend && (
            <span className="shrink-0">
              <Sparkline
                data={sparklineData!}
                changeRate={snapshot.changeRate}
                className="h-9 w-[108px] md:h-11 md:w-[132px]"
              />
            </span>
          )}
        </div>

        {/* ── Price block (flash wrapper uses key to restart animation) ── */}
        <div
          key={flashKey}
          className={`-mx-1 px-1 py-2 rounded-xl ${flashClass}`}
        >
          {isNoBaseline ? (
            <div className="py-1">
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#f5b942] animate-pulse"
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-[#f5b942]">
                  기준가격 갱신 필요
                </p>
              </div>
              <p
                className="font-bold text-[var(--text-muted)] tabular-nums leading-none"
                style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}
                aria-label="예상가격 없음"
              >
                —
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                국내장 마감 기준가격이 등록되면
                <br />
                예상가격이 표시됩니다.
              </p>
            </div>
          ) : (
            <div>
              {/*
                Price and change share a baseline instead of sitting in two
                separate blocks with a filled badge between them. They answer one
                question — what is it worth tonight, and which way did it move —
                so they read as one line, and the eye lands on them together.
                Wrapping is allowed: on a narrow phone the change drops below
                rather than shrinking the price.
              */}
              {/* State first, then what the number is, then the number. The
                  live badge sat in the header a moment ago, a whole card away
                  from the figure it qualifies. */}
              <div className="flex items-center gap-2 leading-none">
                <span
                  className="flex items-center gap-1.5"
                  aria-live="polite"
                  aria-label={`데이터 상태 ${live.label}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0${live.pulse ? " animate-pulse" : ""}`}
                    style={{ backgroundColor: live.color }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[0.6875rem] font-medium"
                    style={{ color: live.color }}
                  >
                    {live.label}
                  </span>
                </span>
                <span className="text-[0.6875rem] text-[var(--text-muted)]">
                  예상가
                </span>
              </div>
              <p
                className="mt-1.5 font-bold text-[var(--text-primary)] tabular-nums leading-none tracking-tight"
                /*
                 * The floor is back at 28px: a phone card is full width again,
                 * so the widest figure the site shows — SK하이닉스 at
                 * 1,691,000원, eleven characters — fits without the number
                 * shrinking to make room for a neighbouring card.
                 */
                style={{ fontSize: "clamp(1.75rem, 7.5vw, 2.5rem)" }}
                aria-label={`예상가격 ${formatKrw(snapshot.estimatedPrice)}`}
              >
                {formatKrw(snapshot.estimatedPrice)}
              </p>
              {/* Its own line under the price, and large enough to be the second
                  thing read. Beside the price it was a footnote to it. */}
              <p
                className={`mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-base md:text-lg font-bold tabular-nums leading-none ${dirColor}`}
              >
                <span>
                  {dirSymbol} {formatChangeAmount(snapshot.changeAmount)}
                </span>
                <span className="text-sm md:text-base font-semibold opacity-75">
                  {formatPercent(snapshot.changeRate)}
                </span>
              </p>
            </div>
          )}
        </div>


        {/*
          ── Foot ──

          One band, not two: the anchor line and the actions used to sit in
          separate sections with a rule each, and the card ended on a short row
          of buttons floating above whitespace. Together they give the card a
          base, and the actions being last is what makes it read as finished.
        */}
        <div className="border-t border-[var(--border-mid)] pt-1 mt-4">
          {/* The one figure a glancing reader needs to place the price above:
              where it was measured from. Everything else that describes the
              calculation waits behind 상세보기. */}
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-[0.6875rem] text-[var(--text-muted)]">
              {krxAnchorLabel}
            </span>
            <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono tabular-nums">
              {snapshot.krxClose > 0 ? formatKrw(snapshot.krxClose) : "—"}
            </span>
          </div>

          {detailsOpen && (
            <div
              id={detailsPanelId}
              /*
               * The panel carries the divider that belongs above its first row.
               * Each MetricRow draws its own top border except the first, and
               * "first" is relative to this wrapper — so without a border here
               * the gap between 최근 국내 종가 and 현재 해외 선물가 was the only
               * one in the list with no line in it.
               */
              className="animate-fade-in border-t border-[var(--border-subtle)]"
            >
              <MetricRow
                label="현재 해외 선물가"
                value={
                  snapshot.currentBinancePrice > 0
                    ? formatBinancePrice(snapshot.currentBinancePrice)
                    : "—"
                }
              />
              <MetricRow
                label={anchorLabel}
                value={
                  snapshot.baselineBinancePrice > 0
                    ? formatBinancePrice(snapshot.baselineBinancePrice)
                    : "—"
                }
              />
              {snapshot.bidPrice !== null && snapshot.askPrice !== null && (
                <MetricRow
                  label="매수 / 매도 호가"
                  value={`${formatBinancePrice(snapshot.bidPrice)} / ${formatBinancePrice(snapshot.askPrice)}`}
                />
              )}
              <MetricRow label="호가 스프레드" value={spreadLabel} />
            </div>
          )}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onToggleChart(stockId)}
              aria-expanded={chartOpen}
              aria-controls={chartPanelId}
              className={ACTION_CLASS}
            >
              {chartOpen ? "차트 닫기" : "차트 보기"}
            </button>

            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-controls={detailsPanelId}
              className={ACTION_CLASS}
            >
              {detailsOpen ? "상세 닫기" : "상세보기"}
            </button>

            {/* Only offered when there is a real number to put in the picture. */}
            {snapshot.status === "healthy" ? (
              <ShareCardButton
                snapshot={snapshot}
                sparklineData={sparklineData}
                className={ACTION_CLASS}
              />
            ) : (
              <span aria-hidden="true" />
            )}
          </div>

          {/*
            A maker's mark, not a banner.
            
            Screenshots of this card travel further than the site does, and a
            card cropped out of a phone screen carries nothing that says where
            the number came from. Small and faint enough to read as part of the
            card's edge rather than a line of content — it takes no row of its
            own and the buttons above it keep their size.
          */}
          <p
            className="mt-1.5 text-center text-[0.5625rem] font-medium tracking-[0.12em] text-[var(--text-muted)] opacity-60 select-none"
            aria-hidden="true"
          >
            {BRAND_NAME}
          </p>
        </div>

      </div>
    </article>
  );
}

/**
 * Memoised, because seven of these share one price feed.
 *
 * The feed flushes about once a second and replaces only the snapshots whose
 * numbers actually moved, so six of the seven cards usually have identical
 * props — but a parent re-render used to redraw all seven anyway, each
 * rebuilding a 72-point SVG path it had already drawn. On a phone repricing
 * continuously that is the difference between one card's work and seven.
 *
 * This is only worth anything while every prop stays referentially stable
 * across renders; DashboardPage memoises the series and the toggle for exactly
 * that reason. Adding an inline arrow or a freshly built array at the call site
 * silently turns this back off.
 */
export const StockEstimateCard = memo(StockEstimateCardImpl);

/**
 * One row inside 상세보기.
 *
 * There is no desktop-only variant any more: these rows used to be always
 * visible with the quote-quality ones hidden below md, and now the whole group
 * is collapsed for everyone. A reader who opened it asked for all of it.
 */
function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      /* Marked so tests can find these rows without pinning a padding value
         that design passes keep changing. */
      data-metric-row=""
      /*
       * The divider sits on the TOP of each row but the first.
       *
       * `last:border-0` counts DOM children, and rows hidden by CSS are still
       * children — so the last row a phone could see kept its bottom border and
       * the footer's own top border landed just below it: two lines under
       * 기준가. Anchoring to `first:` has no such failure mode.
       */
      className="flex items-center justify-between py-1 border-t border-[var(--border-subtle)] first:border-0"
    >
      <span className="text-[0.6875rem] text-[var(--text-muted)]">{label}</span>
      <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono tabular-nums ml-4 text-right">
        {value}
      </span>
    </div>
  );
}
