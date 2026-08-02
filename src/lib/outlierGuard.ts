import {
  MAX_CHANGE_RATE,
  MIN_PRICE_RATIO,
  MAX_PRICE_RATIO,
} from "../config/market";

/**
 * Detects whether a calculated change rate exceeds the ±30% single-update
 * threshold defined in CLAUDE.md §8.3. Used before accepting a new estimate.
 */
export function isChangeRateOutlier(changeRate: number): boolean {
  return Math.abs(changeRate) > MAX_CHANGE_RATE;
}

/**
 * Detects whether the current price is an outlier compared to the previous
 * price. Per CLAUDE.md §8.3: price < 0.5× or price > 2× previous is an
 * anomaly. Returns false when previousPrice is unavailable or non-positive
 * (can't compare without a reference).
 */
export function isPriceRatioOutlier(
  currentPrice: number,
  previousPrice: number
): boolean {
  if (!Number.isFinite(previousPrice) || previousPrice <= 0) return false;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return true;
  const ratio = currentPrice / previousPrice;
  return ratio < MIN_PRICE_RATIO || ratio > MAX_PRICE_RATIO;
}
