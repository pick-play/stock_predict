import { useEffect, useRef, useState } from "react";
import { useNow } from "../../hooks/useNow";
import { RelativeTime } from "../common/RelativeTime";
import type { StockSnapshot } from "../../types/market";
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
import { ShareCardButton } from "./ShareCardButton";
import type { WsConnectionStatus } from "../../lib/binance/websocketAdapter";

/**
 * How often the card re-evaluates whether its price is still fresh.
 *
 * The thresholds it feeds are minutes apart (see staleData), so a finer clock
 * would only buy re-renders.
 */
const FRESHNESS_TICK_MS = 30_000;

interface StockEstimateCardProps {
  snapshot: StockSnapshot;
  sparklineData?: number[];
  animationDelay?: string;
  /** Live-stream state, which decides whether this card may say 실시간. */
  wsStatus?: WsConnectionStatus;
  /** Whether this card's chart is the one currently open below the grid. */
  chartOpen: boolean;
  onToggleChart: () => void;
  /** Ties the button to the panel the page renders. */
  chartPanelId: string;
  /** Grid placement from the page — the phone stacking order. */
  className?: string;
}

export function StockEstimateCard({
  snapshot,
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
  const direction = getDirection(snapshot.changeRate);
  const dirSymbol = formatDirectionSymbol(snapshot.changeRate);
  const isNoBaseline = snapshot.status === "no-baseline";

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

  const dirBadgeCls =
    direction === "rise"
      ? "bg-[rgba(255,77,94,0.1)] border border-[rgba(255,77,94,0.2)]"
      : direction === "fall"
      ? "bg-[rgba(63,130,255,0.1)] border border-[rgba(63,130,255,0.2)]"
      : "bg-[rgba(214,221,232,0.07)] border border-[rgba(214,221,232,0.12)]";

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

      <div className="p-5 md:p-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight leading-none">
                {snapshot.displayName}
              </h2>
              <span className="text-[12px] font-mono text-[var(--text-tertiary)] bg-surface-3 px-1.5 py-0.5 rounded">
                {snapshot.koreanTicker}
              </span>
            </div>
          </div>
          {sparklineData && sparklineData.length >= 2 && (
            <div className="flex-shrink-0 ml-3 mt-0.5">
              <Sparkline data={sparklineData} width={72} height={28} />
            </div>
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
              <p
                className="font-bold text-[var(--text-primary)] tabular-nums leading-none tracking-tight"
                style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
                aria-label={`예상가격 ${formatKrw(snapshot.estimatedPrice)}`}
              >
                {formatKrw(snapshot.estimatedPrice)}
              </p>
              <p className="text-[12px] text-[var(--text-muted)] mt-1.5 leading-none">
                예상가
              </p>
            </div>
          )}
        </div>

        {/* ── Direction badge ── */}
        {!isNoBaseline && (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mt-3 mb-4 ${dirBadgeCls}`}
          >
            <span className={`text-sm font-bold tabular-nums ${dirColor}`}>
              {dirSymbol} {formatChangeAmount(snapshot.changeAmount)}
            </span>
            <span className="text-[#4a5568] select-none">·</span>
            <span className={`text-sm font-medium tabular-nums ${dirColor}`}>
              {formatPercent(snapshot.changeRate)}
            </span>
          </div>
        )}

        {/* ── Metrics table ──
            A phone shows the three rows the headline price is actually derived
            from: the domestic anchor, the current overseas futures price, and the
            futures anchor it is measured against. Without that third row the
            percentage has no visible denominator.

            The bid/ask and the spread stay desktop-only — they describe the
            quality of the quote, not the calculation, and they are detail for
            someone inspecting it rather than someone glancing at a price. */}
        <div className="border-t border-[var(--border-mid)] pt-3 mt-1">
          <MetricRow
            label={krxAnchorLabel}
            value={snapshot.krxClose > 0 ? formatKrw(snapshot.krxClose) : "—"}
          />
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
              desktopOnly
              label="매수 / 매도 호가"
              value={`${formatBinancePrice(snapshot.bidPrice)} / ${formatBinancePrice(snapshot.askPrice)}`}
            />
          )}
          <MetricRow desktopOnly label="호가 스프레드" value={spreadLabel} />
        </div>

        {/* ── Footer: live state + time ── */}
        <div className="border-t border-[var(--border-mid)] pt-3 mt-3">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-1.5"
              aria-live="polite"
              aria-label={`데이터 상태 ${live.label}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0${live.pulse ? " animate-pulse" : ""}`}
                style={{ backgroundColor: live.color }}
                aria-hidden="true"
              />
              <span className="text-xs font-medium" style={{ color: live.color }}>
                {live.label}
              </span>
            </div>
            <RelativeTime
              iso={snapshot.eventTime}
              className="text-[12px] text-[var(--text-muted)] tabular-nums"
            />
          </div>

          {/* ── Chart, collapsed by default ── */}
          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={onToggleChart}
              aria-expanded={chartOpen}
              aria-controls={chartPanelId}
              className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors duration-150"
            >
              {chartOpen ? "차트 닫기" : "차트 보기"}
            </button>

            {/* Share / download button — hidden when no real estimate available */}
            {snapshot.status === "healthy" && (
              <ShareCardButton
                snapshot={snapshot}
                sparklineData={sparklineData}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function MetricRow({
  label,
  value,
  desktopOnly,
}: {
  label: string;
  value: string;
  /**
   * Hidden below the md breakpoint. Done in CSS rather than by branching on a
   * measured width, so the row count cannot change after the first paint.
   */
  desktopOnly?: boolean;
}) {
  return (
    <div
      /*
       * The divider sits on the TOP of each row but the first, not the bottom of
       * each but the last.
       *
       * `last:border-0` counts DOM children, and the desktop-only rows are still
       * children on a phone — merely invisible. So the last row a phone can see
       * kept its bottom border, and the footer's own top border landed just
       * below it: two lines under 기준가. Anchoring to `first:` is safe because
       * the first row is visible on every screen.
       */
      className={`${
        desktopOnly ? "hidden md:flex" : "flex"
      } items-center justify-between py-[5px] border-t border-[var(--border-subtle)] first:border-0`}
    >
      <span className="text-[13px] text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[13px] text-[var(--text-secondary)] font-mono tabular-nums ml-4 text-right">
        {value}
      </span>
    </div>
  );
}
