/**
 * The chart after Recharts.
 *
 * It is drawn by hand now, so the things a library used to guarantee are this
 * file's job: that a curve appears at all, that the domestic close is marked,
 * that hovering names a time and a price, and that a thin series still says so
 * instead of drawing a shape from one point (§12).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceChart } from "../PriceChart";
import type { HistoryEntry } from "../../../types/market";

function history(count: number, gapAt?: number): HistoryEntry[] {
  const start = Date.now() - count * 5 * 60_000;
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(start + i * 5 * 60_000).toISOString(),
    stocks: {
      samsung:
        i === gapAt
          ? undefined
          : {
              estimatedPrice: 230_000 + i * 100,
              changeRate: i * 0.001,
            },
    },
  })) as unknown as HistoryEntry[];
}

function renderChart(entries: HistoryEntry[]) {
  return render(
    <PriceChart
      history={entries}
      krxClose={{ samsung: 230_500 }}
      range="6h"
      onRangeChange={() => {}}
      stockId="samsung"
    />
  );
}

describe("PriceChart", () => {
  it("draws the series and marks the domestic close", () => {
    const { container } = renderChart(history(12));

    // One area and one line for a series with no gaps.
    expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("종가")).toBeInTheDocument();
    expect(container.querySelector("line[stroke-dasharray]")).toBeTruthy();
  });

  it("breaks the line at a missing sample rather than bridging it", () => {
    const withGap = renderChart(history(12, 6));
    const whole = renderChart(history(12));

    const strokes = (r: typeof whole) =>
      r.container.querySelectorAll('path[stroke="#8b7cff"]').length;
    expect(strokes(withGap)).toBe(strokes(whole) + 1);
  });

  it("says so rather than drawing a shape from one point", () => {
    renderChart(history(1));
    expect(screen.getByText("표시할 가격 추이가 없습니다.")).toBeInTheDocument();
  });

  it("labels the y axis in won and the x axis in KST", () => {
    const { container } = renderChart(history(12));
    const labels = [...container.querySelectorAll("text")].map(
      (t) => t.textContent ?? ""
    );

    expect(labels.some((l) => /^\d{1,3}(,\d{3})+$/.test(l))).toBe(true);
    expect(labels.some((l) => /^\d{2}:\d{2}$/.test(l))).toBe(true);
  });

  /*
   * The tooltip is the only place the chart states a value in words, and a
   * pointer handler covers mouse, pen and touch alike — a phone reads this by
   * dragging along the curve exactly as a cursor does.
   */
  it("names a time and a price under the pointer", () => {
    const { container } = renderChart(history(12));
    const svg = container.querySelector("svg")!;

    fireEvent.pointerMove(svg, { clientX: 300, clientY: 100 });

    const tip = screen.getByRole("status");
    expect(tip.textContent).toMatch(/예상가격 [\d,]+원/);
    expect(tip.textContent).toMatch(/야간변동/);

    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("names the chart for a reader who cannot see it", () => {
    renderChart(history(12));
    expect(
      screen.getByRole("img", { name: "삼성전자 가격 추이 차트" })
    ).toBeInTheDocument();
  });
});
