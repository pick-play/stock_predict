/**
 * A "12초 전" readout that ticks on its own.
 *
 * The point is what it does NOT do: the second-by-second clock lives here, in a
 * leaf, so a tick repaints one text node. When the card above it subscribed to
 * the same clock, every second re-rendered the whole card — price block,
 * sparkline, metric table — sixty times a minute, per card, forever. That is
 * work a phone pays for in heat.
 *
 * Anything on the page that changes only every few minutes (staleness state,
 * a market session badge) should subscribe at a coarse resolution instead of
 * borrowing this one.
 */

import { formatRelativeTime } from "../../lib/format";
import { useNow } from "../../hooks/useNow";

interface RelativeTimeProps {
  /** ISO 8601 instant to measure from. */
  iso: string;
  className?: string;
  /** Overrides the default "N초 전 업데이트" reading for screen readers. */
  ariaLabelSuffix?: string;
}

export function RelativeTime({
  iso,
  className,
  ariaLabelSuffix = "업데이트",
}: RelativeTimeProps) {
  const now = useNow();
  const label = formatRelativeTime(iso, now);

  return (
    <span className={className} aria-label={`${label} ${ariaLabelSuffix}`}>
      {label}
    </span>
  );
}
