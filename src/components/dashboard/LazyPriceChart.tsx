import { lazy, Suspense } from "react";
import { ChartSkeleton } from "../common/LoadingSkeleton";
import type { HistoryEntry, StockId } from "../../types/market";
import type { ChartRange } from "../../lib/binance/klineHistory";

const PriceChartLazy = lazy(() =>
  import("./PriceChart").then((m) => ({ default: m.PriceChart }))
);

interface LazyPriceChartProps {
  history: HistoryEntry[];
  krxClose?: Partial<Record<StockId, number>>;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  isLoading?: boolean;
  /** Pins the chart to one stock and hides the stock selector. */
  stockId?: StockId;
  /** Drops the card chrome when a card already provides it. */
  embedded?: boolean;
}

export function LazyPriceChart(props: LazyPriceChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <PriceChartLazy {...props} />
    </Suspense>
  );
}
