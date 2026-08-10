/**
 * Number formatting for the ticker tape.
 *
 * Kept out of lib/format.ts because that module's formatPercent takes a rate and
 * multiplies by 100, while every value on the tape already arrives in percentage
 * points. Reusing it would silently inflate a 0.62% move to 62%.
 */

const KRW_INDEX_IDS = new Set(["kospi", "kosdaq"]);

/**
 * Index points, dollars and yields all render as plain grouped decimals; the
 * unit is drawn separately and smaller. Locale grouping stays ko-KR so the
 * separators match the rest of the page.
 */
export function formatTickerPrice(value: number, decimals: number): string {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Percentage points, already scaled. 0 stays unsigned, matching §24. */
export function formatTickerPercent(percentPoints: number): string {
  if (!Number.isFinite(percentPoints)) return "―";
  if (percentPoints === 0) return "0.00%";
  const sign = percentPoints > 0 ? "+" : "";
  return `${sign}${percentPoints.toFixed(2)}%`;
}

/**
 * Korean indices are quoted in points but read as domestic market levels, so
 * they get no unit suffix. Exposed as a helper so the component does not need to
 * know which ids are which.
 */
export function isKrwIndex(id: string): boolean {
  return KRW_INDEX_IDS.has(id);
}
