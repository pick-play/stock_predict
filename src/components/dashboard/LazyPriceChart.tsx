import { lazy, Suspense } from "react";
import { ChartSkeleton } from "../common/LoadingSkeleton";
import type { HistoryEntry, StockId } from "../../types/market";

const PriceChartLazy = lazy(() =>
  import("./PriceChart").then((m) => ({ default: m.PriceChart }))
);

interface LazyPriceChartProps {
  history: HistoryEntry[];
  krxClose?: Partial<Record<StockId, number>>;
}

export function LazyPriceChart(props: LazyPriceChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <PriceChartLazy {...props} />
    </Suspense>
  );
}
