import type { StockSnapshot, StockId } from "../../types/market";
import { formatKrw, formatBinancePrice, formatPercent, getDirection } from "../../lib/format";

interface PriceBreakdownProps {
  stocks: Partial<Record<StockId, StockSnapshot>>;
}

export function PriceBreakdown({ stocks }: PriceBreakdownProps) {
  const stockIds: StockId[] = ["samsung", "skHynix"];
  const entries = stockIds
    .map((id) => ({ id, snapshot: stocks[id] }))
    .filter(
      (e): e is { id: StockId; snapshot: StockSnapshot } => !!e.snapshot
    );

  if (entries.length === 0) return null;

  return (
    <div className="animate-slide-fade-in delay-350 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-surface-1 p-5 md:p-6">
      <h3 className="text-xs font-semibold text-[#6f7a8c] uppercase tracking-widest mb-4">
        계산 기준
      </h3>

      <div className="space-y-5">
        {entries.map(({ id, snapshot }) => {
          const dir = getDirection(snapshot.changeRate);
          const rateColor =
            dir === "rise"
              ? "text-[#ff4d5e]"
              : dir === "fall"
              ? "text-[#3f82ff]"
              : "text-[#d6dde8]";

          return (
            <div key={id}>
              <p className="text-[12px] font-semibold text-[#6f7a8c] uppercase tracking-widest mb-2">
                {snapshot.displayName}
              </p>

              <div className="space-y-0">
                <FormulaRow
                  label="최근 국내 종가"
                  value={
                    snapshot.krxClose > 0
                      ? formatKrw(snapshot.krxClose)
                      : "—"
                  }
                />
                <FormulaRow
                  label="× 현재 바이낸스 기준가"
                  value={
                    snapshot.currentBinancePrice > 0
                      ? formatBinancePrice(snapshot.currentBinancePrice)
                      : "—"
                  }
                  indent
                />
                <FormulaRow
                  label="÷ 마감시 바이낸스 기준가"
                  value={
                    snapshot.baselineBinancePrice > 0
                      ? formatBinancePrice(snapshot.baselineBinancePrice)
                      : "—"
                  }
                  indent
                />

                {/* Result row */}
                <div className="flex items-center justify-between pt-2 mt-0.5 border-t border-[rgba(255,255,255,0.05)]">
                  <span className="text-[13px] text-[#a6b0c0] font-medium">
                    야간 변동률
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${rateColor}`}
                  >
                    {snapshot.status !== "no-baseline"
                      ? formatPercent(snapshot.changeRate)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormulaRow({
  label,
  value,
  indent = false,
}: {
  label: string;
  value: string;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-[5px] border-b border-[rgba(255,255,255,0.04)] ${
        indent ? "pl-2" : ""
      }`}
    >
      <span className="text-[13px] text-[#6f7a8c]">{label}</span>
      <span className="text-[13px] text-[#a6b0c0] font-mono tabular-nums ml-4">
        {value}
      </span>
    </div>
  );
}
