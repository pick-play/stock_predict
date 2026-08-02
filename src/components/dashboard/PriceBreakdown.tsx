import type { StockSnapshot, StockId } from "../../types/market";
import { formatKrw, formatBinancePrice, formatPercent } from "../../lib/format";

interface PriceBreakdownProps {
  stocks: Partial<Record<StockId, StockSnapshot>>;
}

export function PriceBreakdown({ stocks }: PriceBreakdownProps) {
  const stockIds: StockId[] = ["samsung", "skHynix"];
  const entries = stockIds
    .map((id) => ({ id, snapshot: stocks[id] }))
    .filter((e): e is { id: StockId; snapshot: StockSnapshot } => !!e.snapshot);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6">
      <h3 className="text-sm font-semibold text-[#f4f7fb] mb-4">계산 기준</h3>
      <div className="space-y-4">
        {entries.map(({ id, snapshot }) => (
          <div key={id}>
            <p className="text-xs font-medium text-[#a6b0c0] mb-2">{snapshot.displayName}</p>
            <div className="space-y-1.5 text-xs text-[#6f7a8c]">
              <FormulaRow
                label="최근 국내 종가"
                value={snapshot.krxClose > 0 ? formatKrw(snapshot.krxClose) : "—"}
              />
              <FormulaRow
                label="× 현재 바이낸스 기준가격"
                value={snapshot.currentBinancePrice > 0 ? formatBinancePrice(snapshot.currentBinancePrice) : "—"}
              />
              <FormulaRow
                label="÷ 마감시 바이낸스 기준가격"
                value={snapshot.baselineBinancePrice > 0 ? formatBinancePrice(snapshot.baselineBinancePrice) : "—"}
              />
              <div className="border-t border-[rgba(255,255,255,0.07)] pt-1.5">
                <FormulaRow
                  label="야간 변동률"
                  value={snapshot.status !== "no-baseline" ? formatPercent(snapshot.changeRate) : "—"}
                  highlight
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormulaRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={`font-mono tabular-nums ${highlight ? "text-[#f4f7fb] font-medium" : "text-[#a6b0c0]"}`}>
        {value}
      </span>
    </div>
  );
}
