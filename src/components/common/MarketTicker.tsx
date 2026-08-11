/**
 * Scrolling market tape.
 *
 * The track holds the item list twice and slides left by exactly half its
 * width, so the second copy is in the first one's place when the animation
 * loops and the seam is invisible. That is why the duplicate exists — it is not
 * redundant markup.
 *
 * Motion is decorative, so the whole animation is dropped under
 * prefers-reduced-motion and the strip becomes an ordinary scrollable row. It
 * has to be dropped explicitly: the global reduced-motion rule in index.css
 * collapses animation-duration to 0.01ms, which for a marquee would snap the
 * track to its end state and hide half the items.
 */

import { useSharedMarketData } from "../../lib/markets/marketDataContext";
import { formatDirectionSymbol, getDirection } from "../../lib/format";
import {
  formatTickerPrice,
  formatTickerPercent,
} from "../../lib/markets/formatTicker";
import type { TickerItem } from "../../types/ticker";

const DIRECTION_CLASS: Record<string, string> = {
  rise: "text-rise",
  fall: "text-fall",
  neutral: "text-[var(--text-secondary)]",
};

function StatusBadge({ item }: { item: TickerItem }) {
  if (item.isLive) {
    return (
      <span className="text-[12px] px-1.5 py-0.5 rounded bg-success/15 text-success whitespace-nowrap">
        실시간
      </span>
    );
  }
  if (item.status === "closed") {
    return (
      <span className="text-[12px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-tertiary)] whitespace-nowrap">
        장 마감
      </span>
    );
  }
  if (item.isStale) {
    return (
      <span className="text-[12px] px-1.5 py-0.5 rounded bg-warning/15 text-warning whitespace-nowrap">
        지연
      </span>
    );
  }
  if (item.status === "open") {
    return (
      <span className="text-[12px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)] whitespace-nowrap">
        장중
      </span>
    );
  }
  return null;
}

function TickerCell({ item }: { item: TickerItem }) {
  const direction = getDirection(item.changePercent);

  return (
    <div className="flex items-center gap-2 px-4 shrink-0 tabular-nums">
      <span className="text-[14px] text-[var(--text-secondary)] whitespace-nowrap">
        {item.label}
      </span>

      <span className="text-[14px] font-semibold text-[var(--text-primary)] whitespace-nowrap">
        {formatTickerPrice(item.price, item.decimals)}
        {item.unit && (
          <span className="ml-1 text-[12px] font-normal text-[var(--text-tertiary)]">
            {item.unit}
          </span>
        )}
      </span>

      {/* Sign and arrow travel with the colour so the direction survives a
          colour-blind reader and a monochrome screenshot alike (§11.2, §19). */}
      <span
        className={`text-[14px] whitespace-nowrap ${DIRECTION_CLASS[direction]}`}
      >
        {formatDirectionSymbol(item.changePercent)}{" "}
        {formatTickerPercent(item.changePercent)}
      </span>

      <StatusBadge item={item} />
    </div>
  );
}

interface MarketTickerProps {
  /**
   * Which edge the strip is attached to. Desktop hangs it under the header;
   * mobile pins it to the bottom bar, where it replaced the update clock.
   */
  edge?: "top" | "bottom";
  className?: string;
}

export function MarketTicker({
  edge = "top",
  className = "",
}: MarketTickerProps) {
  const { items, isLoading } = useSharedMarketData();

  const edgeClass =
    edge === "top"
      ? "border-b border-[var(--border-subtle)]"
      : "border-t border-[var(--border-subtle)]";

  // Nothing to say yet, or the proxy is not configured for this build: take up
  // no space rather than reserving an empty strip.
  if (items.length === 0) {
    if (!isLoading) return null;
    return (
      <div
        className={`h-10 ${edgeClass} bg-[var(--surface-1)] ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Duration scales with the item count so a longer tape does not scroll faster.
  const durationSec = Math.max(30, items.length * 6);

  const summary = items
    .map(
      (i) =>
        `${i.label} ${formatTickerPrice(i.price, i.decimals)} ${formatTickerPercent(i.changePercent)}`
    )
    .join(", ");

  return (
    <div
      className={`market-ticker ${edgeClass} bg-[var(--surface-1)] ${className}`}
      role="region"
      aria-label="주요 지수 시세"
    >
      {/* The moving copy is decorative; a screen reader gets the static list
          below instead of a stream of duplicated cells. */}
      <div className="market-ticker__viewport" aria-hidden="true">
        <div
          className="market-ticker__track"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {items.map((item) => (
            <TickerCell key={item.id} item={item} />
          ))}
          {items.map((item) => (
            <TickerCell key={`dup-${item.id}`} item={item} />
          ))}
        </div>
      </div>

      <p className="sr-only">{summary}</p>
    </div>
  );
}
