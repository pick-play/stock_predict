/**
 * The arithmetic behind PriceChart, kept out of the component.
 *
 * Pure functions over numbers, which is what makes them testable without a DOM
 * and what keeps the drawing code down to path strings.
 */

/**
 * A rounded step near `rough`, from the 1 / 2 / 5 family.
 *
 * Axis labels are read, not measured: 1,000 / 1,500 / 2,000 is legible where
 * 1,237 / 1,856 / 2,474 is noise, even though both divide the range evenly.
 */
export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Tick values covering [min, max] on a rounded step.
 *
 * Returns the ticks that fall inside the domain, so the axis never labels a
 * value the chart does not reach.
 */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const step = niceStep((max - min) / Math.max(1, count));
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 1e-9; v += step) ticks.push(v);
  return ticks;
}

export interface Point {
  time: number;
  price: number | null;
  changeRate: number | null;
}

/**
 * Splits a series at its gaps.
 *
 * A missing sample is a missing sample: §12 asks for the gap to be visible
 * rather than bridged by a straight line that never happened, so each run of
 * real points becomes its own path.
 */
export function segments(points: Point[]): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (p.price === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/**
 * The vertical domain: the data, the baseline, and a little air.
 *
 * The baseline is included because a chart that crops its own reference line
 * out of view is worse than one that shows a wider range. A flat series gets an
 * arbitrary ±0.5% so it draws as a line through the middle rather than dividing
 * by zero.
 */
export function priceDomain(
  prices: number[],
  baseline?: number
): [number, number] {
  const values = baseline !== undefined ? [...prices, baseline] : prices;
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    const air = Math.abs(max) * 0.005 || 1;
    return [min - air, max + air];
  }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  return [min, max];
}

/** Index of the sample nearest a time value. Binary search: series run to 168. */
export function nearestIndex(points: Point[], time: number): number {
  if (points.length === 0) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  const prev = Math.max(0, lo - 1);
  return Math.abs(points[prev].time - time) <= Math.abs(points[lo].time - time)
    ? prev
    : lo;
}
