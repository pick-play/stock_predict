/**
 * The arithmetic the chart is drawn from, tested without a DOM.
 *
 * These are the rules that would fail silently: a gap bridged by a straight
 * line looks like data, a baseline cropped out of view looks like there is no
 * baseline, and an axis labelled 1,237 / 1,856 looks like a rendering bug.
 */

import { describe, expect, it } from "vitest";
import {
  nearestIndex,
  niceStep,
  niceTicks,
  priceDomain,
  segments,
  type Point,
} from "../chartGeometry";

const at = (time: number, price: number | null): Point => ({
  time,
  price,
  changeRate: null,
});

describe("niceStep", () => {
  it("rounds to the 1 / 2 / 5 family", () => {
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.7)).toBe(2);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(1_237)).toBe(2_000);
    expect(niceStep(87_000)).toBe(100_000);
  });

  it("survives a degenerate range instead of returning 0 or NaN", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
  });
});

describe("niceTicks", () => {
  it("labels only values the chart actually reaches", () => {
    const ticks = niceTicks(203_000, 217_400, 4);
    expect(Math.min(...ticks)).toBeGreaterThanOrEqual(203_000);
    expect(Math.max(...ticks)).toBeLessThanOrEqual(217_400);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it("returns something drawable for a flat domain", () => {
    expect(niceTicks(5, 5, 4)).toEqual([5]);
  });
});

describe("segments", () => {
  /*
   * §12: a missing sample is shown as missing. Bridging it draws a straight
   * line through hours that were never measured, which reads as a calm market.
   */
  it("breaks the line where samples are missing", () => {
    const runs = segments([
      at(1, 100),
      at(2, 101),
      at(3, null),
      at(4, 103),
      at(5, 104),
    ]);
    expect(runs).toHaveLength(2);
    expect(runs[0].map((p) => p.price)).toEqual([100, 101]);
    expect(runs[1].map((p) => p.price)).toEqual([103, 104]);
  });

  it("draws nothing from a series that is entirely missing", () => {
    expect(segments([at(1, null), at(2, null)])).toEqual([]);
  });
});

describe("priceDomain", () => {
  it("keeps the baseline inside the view", () => {
    // A night that only fell: the close is above everything drawn.
    const [min, max] = priceDomain([100, 98, 96], 130);
    expect(min).toBeLessThan(96);
    expect(max).toBeGreaterThanOrEqual(130);
  });

  it("gives a flat series room instead of dividing by zero", () => {
    const [min, max] = priceDomain([200, 200, 200]);
    expect(max).toBeGreaterThan(min);
    expect(Number.isFinite(min) && Number.isFinite(max)).toBe(true);
  });
});

describe("nearestIndex", () => {
  const points = [at(0, 1), at(100, 2), at(200, 3), at(300, 4)];

  it("picks the closer neighbour, not the next one", () => {
    expect(nearestIndex(points, 149)).toBe(1);
    expect(nearestIndex(points, 151)).toBe(2);
  });

  it("clamps to the ends", () => {
    expect(nearestIndex(points, -500)).toBe(0);
    expect(nearestIndex(points, 5_000)).toBe(3);
  });
});
