/**
 * Seven cards share one price feed that flushes about once a second.
 *
 * The feed replaces only the snapshots whose numbers moved, so most of those
 * flushes leave six cards with identical props — and before the memo, all seven
 * re-rendered anyway, each rebuilding a 72-point SVG path it had already drawn.
 *
 * The memo is easy to switch off by accident: one inline arrow or one freshly
 * built array at the call site and every card renders every tick again, with
 * nothing visibly wrong to notice. These tests pin both halves — the memo
 * itself, and the prop stability it depends on.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { StockSnapshot } from "../../../types/market";

const sparklineRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("../Sparkline", () => ({
  Sparkline: () => {
    sparklineRenders.count += 1;
    return null;
  },
}));
vi.mock("../ShareCardButton", () => ({ ShareCardButton: () => null }));

const { StockEstimateCard } = await import("../StockEstimateCard");

const SNAPSHOT: StockSnapshot = {
  displayName: "삼성전자",
  koreanTicker: "005930",
  binanceSymbol: "SAMSUNGUSDT",
  krxClose: 230000,
  baselineBinancePrice: 182.63,
  currentBinancePrice: 165.31,
  referencePriceMode: "mark",
  bidPrice: 165.31,
  askPrice: 165.33,
  spreadPercent: 0.012,
  confidenceScore: 90,
  eventTime: "2026-08-10T12:59:50.000Z",
  rawEstimatedPrice: 208200.5,
  estimatedPrice: 208000,
  changeAmount: -22000,
  changeRate: -0.0948,
  status: "healthy",
} as StockSnapshot;

const SERIES = [1, 2, 3];
const noop = () => {};

function card(snapshot: StockSnapshot) {
  return (
    <StockEstimateCard
      snapshot={snapshot}
      stockId="samsung"
      sparklineData={SERIES}
      wsStatus="connected"
      chartOpen={false}
      onToggleChart={noop}
      chartPanelId="stock-chart-panel"
    />
  );
}

describe("StockEstimateCard memoisation", () => {
  it("does not re-render when nothing about this card changed", () => {
    sparklineRenders.count = 0;
    const { rerender } = render(card(SNAPSHOT));
    expect(sparklineRenders.count).toBe(1);

    // What a flush looks like for a card whose own numbers held still.
    rerender(card(SNAPSHOT));
    rerender(card(SNAPSHOT));

    expect(sparklineRenders.count).toBe(1);
  });

  it("still re-renders when its own snapshot moves", () => {
    sparklineRenders.count = 0;
    const { rerender } = render(card(SNAPSHOT));

    rerender(card({ ...SNAPSHOT, estimatedPrice: 209000 }));

    // More than once, not exactly twice: a moved price also restarts the flash
    // animation, which is a second render by design.
    expect(sparklineRenders.count).toBeGreaterThan(1);
  });
});
