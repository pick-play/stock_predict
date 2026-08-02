export function StockCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-[#18202e]" />
        <div className="h-4 w-16 rounded bg-[#18202e]" />
      </div>
      <div className="h-10 w-40 rounded bg-[#18202e] mb-2" />
      <div className="h-4 w-28 rounded bg-[#18202e] mb-6" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[#18202e]" />
        <div className="h-3 w-3/4 rounded bg-[#18202e]" />
        <div className="h-3 w-2/3 rounded bg-[#18202e]" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-[#18202e] mb-6" />
      <div className="h-48 w-full rounded bg-[#18202e]" />
    </div>
  );
}
