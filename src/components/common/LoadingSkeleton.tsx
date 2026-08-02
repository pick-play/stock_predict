export function StockCardSkeleton() {
  return (
    <div
      className="relative rounded-2xl border border-[rgba(255,255,255,0.07)] bg-surface-1 overflow-hidden animate-pulse"
      aria-label="가격 데이터 로딩 중"
    >
      {/* Accent bar placeholder */}
      <div className="h-[2px] bg-surface-3" />

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-20 rounded bg-surface-3" />
              <div className="h-4 w-10 rounded bg-surface-3" />
            </div>
            <div className="h-3 w-28 rounded bg-surface-3" />
          </div>
          <div className="w-[72px] h-7 rounded bg-surface-3 ml-3" />
        </div>

        {/* Price block */}
        <div className="-mx-1 px-1 py-2">
          <div className="h-12 w-48 rounded-lg bg-surface-3 mb-2" />
          <div className="h-3 w-40 rounded bg-surface-3" />
        </div>

        {/* Direction badge */}
        <div className="h-8 w-36 rounded-lg bg-surface-3 mt-3 mb-4" />

        {/* Metrics */}
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 space-y-[5px]">
          {[80, 64, 64, 56, 48].map((w, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-[5px] border-b border-[rgba(255,255,255,0.04)] last:border-0"
            >
              <div
                className="h-3 rounded bg-surface-3"
                style={{ width: `${w}px` }}
              />
              <div className="h-3 w-16 rounded bg-surface-3" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-28 rounded bg-surface-3" />
            <div className="h-3 w-10 rounded bg-surface-3" />
          </div>
          <div className="h-[2px] w-full rounded-full bg-surface-3" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-surface-1 p-5 md:p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          <div className="h-9 w-20 rounded-lg bg-surface-3" />
          <div className="h-9 w-24 rounded-lg bg-surface-3" />
        </div>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-12 rounded-lg bg-surface-3" />
          ))}
        </div>
      </div>
      <div className="h-56 w-full rounded-xl bg-surface-3" />
    </div>
  );
}
