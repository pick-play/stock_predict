/**
 * Placeholders sized to the components they stand in for (§18: a skeleton that
 * matches the real card's height is what keeps the first data from jumping the
 * page).
 *
 * StockCardSkeleton mirrors the card as it renders by default after the
 * 2026-08-21/22 redesign (§28.8): name with ticker under it and a sparkline at
 * the header's edge, status line over a large price with the change on its own
 * line below, then a foot of one 종가 row, the three-way action band and the
 * brand mark. The old direction badge and five always-visible metric rows are
 * gone from the card — 상세보기 holds them now — so they are gone from here
 * too; a skeleton shaped like a layout that no longer exists measures the
 * wrong height.
 *
 * Borders use the theme tokens, not spelled-out white alphas: a
 * rgba(255,255,255,…) line is invisible on the light palette, and the skeleton
 * is the first thing a light-mode reader sees.
 */
export function StockCardSkeleton() {
  return (
    <div
      className="relative rounded-2xl border border-[var(--border-subtle)] bg-surface-1 overflow-hidden animate-pulse"
      aria-label="가격 데이터 로딩 중"
    >
      {/* Accent bar placeholder */}
      <div className="h-[2px] bg-surface-3" />

      <div className="px-3.5 pt-4 pb-2.5 md:px-6 md:pt-6 md:pb-3.5">
        {/* Header: name + ticker on the left, sparkline at the edge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="h-5 md:h-6 w-28 rounded bg-surface-3" />
            <div className="mt-1 h-4 w-12 rounded bg-surface-3" />
          </div>
          <div className="h-9 w-[108px] md:h-11 md:w-[132px] shrink-0 rounded bg-surface-3" />
        </div>

        {/* Price block: status line, price, change line */}
        <div className="-mx-1 px-1 py-2">
          <div className="h-4 w-24 rounded bg-surface-3" />
          <div className="mt-1.5 h-7 md:h-10 w-44 rounded-lg bg-surface-3" />
          <div className="mt-1.5 h-4 md:h-[18px] w-36 rounded bg-surface-3" />
        </div>

        {/* Foot: anchor row, three-way action band, brand mark */}
        <div className="border-t border-[var(--border-mid)] pt-1 mt-4">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="h-4 w-28 rounded bg-surface-3" />
            <div className="h-4 w-16 rounded bg-surface-3" />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-surface-3" />
            ))}
          </div>
          <div className="mt-1.5 mx-auto h-3 w-16 rounded bg-surface-3" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface-1 p-5 md:p-6 animate-pulse">
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
