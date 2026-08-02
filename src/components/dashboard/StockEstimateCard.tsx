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

interface StockEstimateCardProps {
  snapshot: StockSnapshot;
}

export function StockEstimateCard({ snapshot }: StockEstimateCardProps) {
  const direction = getDirection(snapshot.changeRate);

  const dirSymbol = formatDirectionSymbol(snapshot.changeRate);

  const dirColor =
    direction === "rise"
      ? "text-[#ff4d5e]"
      : direction === "fall"
      ? "text-[#3f82ff]"
      : "text-[#d6dde8]";

  const dirBg =
    direction === "rise"
      ? "bg-[rgba(255,77,94,0.14)]"
      : direction === "fall"
      ? "bg-[rgba(63,130,255,0.14)]"
      : "bg-[rgba(214,221,232,0.08)]";

  const confScore = snapshot.confidenceScore;
  const confColor =
    confScore >= CONFIDENCE_THRESHOLDS.good
      ? "text-[#31c48d]"
      : confScore >= CONFIDENCE_THRESHOLDS.fair
      ? "text-[#f5b942]"
      : "text-[#ff5d6c]";

  const confLabel =
    confScore >= CONFIDENCE_THRESHOLDS.good
      ? "데이터 양호"
      : confScore >= CONFIDENCE_THRESHOLDS.fair
      ? "참고 가능"
      : confScore >= CONFIDENCE_THRESHOLDS.caution
      ? "변동성 주의"
      : "신뢰도 낮음";

  const isNoBaseline = snapshot.status === "no-baseline";

  const spreadLabel =
    snapshot.spreadPercent !== null
      ? `${snapshot.spreadPercent.toFixed(4)}%`
      : "—";

  return (
    <article className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6 hover:-translate-y-1 transition-transform duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-[#f4f7fb]">
            {snapshot.displayName}
          </h2>
          <p className="text-xs text-[#6f7a8c] mt-0.5">{snapshot.koreanTicker}</p>
        </div>
        <span className="text-xs text-[#6f7a8c] font-mono">{snapshot.binanceSymbol}</span>
      </div>

      {/* Price */}
      {isNoBaseline ? (
        <div className="mb-5">
          <p className="text-2xl font-bold text-[#6f7a8c]">—</p>
          <p className="text-xs text-[#6f7a8c] mt-1">
            국내장 마감 기준가격이 아직 등록되지 않았습니다.
          </p>
        </div>
      ) : (
        <div className="mb-1">
          <div className="text-4xl font-bold text-[#f4f7fb] font-variant-numeric tabular-nums leading-none">
            {formatKrw(snapshot.estimatedPrice)}
          </div>
          <p className="text-xs text-[#6f7a8c] mt-1">
            한국거래소 호가단위로 반올림한 참고 예상가
          </p>
        </div>
      )}

      {/* Change */}
      {!isNoBaseline && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${dirBg} mt-3 mb-5`}>
          <span className={`text-sm font-bold ${dirColor}`}>
            {dirSymbol} {formatChangeAmount(snapshot.changeAmount)}
          </span>
          <span className={`text-sm ${dirColor}`}>
            {formatPercent(snapshot.changeRate)}
          </span>
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-2 border-t border-[rgba(255,255,255,0.07)] pt-4 mt-4">
        <MetricRow
          label="최근 국내 종가"
          value={snapshot.krxClose > 0 ? formatKrw(snapshot.krxClose) : "—"}
        />
        <MetricRow
          label="바이낸스 현재 기준가격"
          value={snapshot.currentBinancePrice > 0 ? formatBinancePrice(snapshot.currentBinancePrice) : "—"}
        />
        <MetricRow
          label="국내 마감시 기준가격"
          value={snapshot.baselineBinancePrice > 0 ? formatBinancePrice(snapshot.baselineBinancePrice) : "—"}
        />
        <MetricRow
          label="호가 스프레드"
          value={spreadLabel}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)]">
        <span className={`text-xs font-medium ${confColor}`}>
          {confLabel} · {confScore}/100
        </span>
        <span className="text-xs text-[#6f7a8c]">
          {formatRelativeTime(snapshot.eventTime)}
        </span>
      </div>
    </article>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#6f7a8c]">{label}</span>
      <span className="text-xs text-[#a6b0c0] font-mono tabular-nums">{value}</span>
    </div>
  );
}
