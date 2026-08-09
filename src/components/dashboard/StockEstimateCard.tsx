import { useEffect, useRef, useState } from "react";
import { useNow } from "../../hooks/useNow";
import type { StockSnapshot } from "../../types/market";
import {
  formatKrw,
  formatPercent,
  formatChangeAmount,
  formatDirectionSymbol,
  getDirection,
  formatRelativeTime,
  formatBinancePrice,
} from "../../lib/format";
import { CONFIDENCE_THRESHOLDS } from "../../config/theme";
import { getLastKrxCloseMs, getSeoulDate } from "../../lib/koreaMarket";
import { Sparkline } from "./Sparkline";

interface StockEstimateCardProps {
  snapshot: StockSnapshot;
  sparklineData?: number[];
  animationDelay?: string;
}

export function StockEstimateCard({
  snapshot,
  sparklineData,
  animationDelay,
}: StockEstimateCardProps) {
  const now = useNow();
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

  // Confidence tokens
  const confScore = snapshot.confidenceScore;
  const confColor =
    confScore >= CONFIDENCE_THRESHOLDS.good
      ? "#31c48d"
      : confScore >= CONFIDENCE_THRESHOLDS.fair
      ? "#f5b942"
      : "#ff5d6c";
  const confLabel =
    confScore >= CONFIDENCE_THRESHOLDS.good
      ? "데이터 양호"
      : confScore >= CONFIDENCE_THRESHOLDS.fair
      ? "참고 가능"
      : confScore >= CONFIDENCE_THRESHOLDS.caution
      ? "변동성 주의"
      : "신뢰도 낮음";

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
      className="animate-slide-fade-in relative rounded-2xl border border-[var(--border-subtle)] bg-surface-1 overflow-hidden hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-xl hover:shadow-black/20 transition-all duration-200 ease-out"
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
              <span className="text-[10px] font-mono text-[var(--text-tertiary)] bg-surface-3 px-1.5 py-0.5 rounded">
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
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5 leading-none">
                한국거래소 호가단위로 반올림한 참고 예상가
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

        {/* ── Metrics table ── */}
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
              label="매수 / 매도 호가"
              value={`${formatBinancePrice(snapshot.bidPrice)} / ${formatBinancePrice(snapshot.askPrice)}`}
            />
          )}
          <MetricRow label="호가 스프레드" value={spreadLabel} />
        </div>

        {/* ── Footer: confidence + time ── */}
        <div className="border-t border-[var(--border-mid)] pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: confColor }}
                aria-hidden="true"
              />
              <span
                className="text-xs font-medium"
                style={{ color: confColor }}
              >
                {confLabel}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                · {confScore}/100
              </span>
            </div>
            <span
              className="text-[10px] text-[var(--text-muted)] tabular-nums"
              aria-label={`${formatRelativeTime(snapshot.eventTime, now)} 업데이트`}
            >
              {formatRelativeTime(snapshot.eventTime, now)}
            </span>
          </div>

          {/* Confidence progress bar */}
          <div
            className="h-[2px] rounded-full bg-[var(--border-mid)] overflow-hidden"
            role="meter"
            aria-valuenow={confScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`데이터 신뢰도 ${confScore}/100`}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${confScore}%`, backgroundColor: confColor }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-[5px] border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums ml-4 text-right">
        {value}
      </span>
    </div>
  );
}
