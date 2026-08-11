/**
 * The ticker's instruments again, as a grid of small cards.
 *
 * Same feed as the tape — read from MarketDataProvider so neither surface pays
 * for its own poll or socket. The tape is for glancing while scrolling past;
 * this is for actually reading, so each cell keeps its market-state badge and
 * the numbers sit still.
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

function StateNote({ item }: { item: TickerItem }) {
  if (item.isLive) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-success">
        <span
          className="w-1 h-1 rounded-full bg-success animate-pulse"
          aria-hidden="true"
        />
        실시간
      </span>
    );
  }
  if (item.status === "closed") {
    return (
      <span className="text-[12px] text-[var(--text-tertiary)]">장 마감</span>
    );
  }
  if (item.isStale) {
    return <span className="text-[12px] text-warning">지연</span>;
  }
  if (item.status === "open") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
        <span
          className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]"
          aria-hidden="true"
        />
        장중
      </span>
    );
  }
  return null;
}

function IndexCard({ item }: { item: TickerItem }) {
  const direction = getDirection(item.changePercent);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-surface-1 px-3 py-2.5 hover:border-[var(--border-strong)] transition-colors duration-200">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[13px] text-[var(--text-secondary)] truncate">
          {item.label}
        </span>
        <StateNote item={item} />
      </div>

      <p className="text-[17px] font-semibold text-[var(--text-primary)] tabular-nums leading-none">
        {formatTickerPrice(item.price, item.decimals)}
        {item.unit && (
          <span className="ml-1 text-[11px] font-normal text-[var(--text-tertiary)]">
            {item.unit}
          </span>
        )}
      </p>

      {/* Arrow and sign carry the direction alongside the colour, so it survives
          a colour-blind reader and a greyscale screenshot (§11.2, §19). */}
      <p
        className={`text-[13px] tabular-nums mt-1 ${DIRECTION_CLASS[direction]}`}
      >
        {formatDirectionSymbol(item.changePercent)}{" "}
        {formatTickerPercent(item.changePercent)}
      </p>
    </div>
  );
}

export function MarketIndexGrid() {
  const { items, isLoading } = useSharedMarketData();

  if (items.length === 0) {
    if (!isLoading) return null;
    return (
      <section aria-label="주요 증시" className="animate-fade-in">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
          주요 증시
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border-subtle)] bg-surface-1 h-[82px]"
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="주요 증시" className="animate-fade-in">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)]">
          주요 증시
        </h2>
        {/* The tape and this grid are the same numbers; only bitcoin is a live
            feed, and saying so once here keeps the badges from over-promising. */}
        <span className="text-[12px] text-[var(--text-muted)]">
          해외 지표는 제공처 사정으로 지연될 수 있습니다
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {items.map((item) => (
          <IndexCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
