import { STALE_WARNING_THRESHOLD_MS, STALE_CRITICAL_THRESHOLD_MS } from "../config/market";

export type DataFreshness = "fresh" | "warning" | "stale" | "unknown";

/*
 * A timestamp far in the future is as untrustworthy as a stale one: it means a
 * broken clock somewhere, and its negative age would sail through every `<`
 * check below as eternally fresh (same guard as githubFallback.ts). Small
 * negative skew is normal — a quote can legitimately be stamped a moment ahead
 * of a clock snapshotted once a second (§28, formatRelativeTime) — so only ages
 * beyond this tolerance are treated as lying about their time.
 */
const FUTURE_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export function getDataFreshness(eventTime: string | null | undefined): DataFreshness {
  if (!eventTime) return "unknown";
  const age = Date.now() - new Date(eventTime).getTime();
  if (age < -FUTURE_SKEW_TOLERANCE_MS) return "stale";
  if (age < STALE_WARNING_THRESHOLD_MS) return "fresh";
  if (age < STALE_CRITICAL_THRESHOLD_MS) return "warning";
  return "stale";
}

export function isDataStale(eventTime: string | null | undefined): boolean {
  return getDataFreshness(eventTime) === "stale";
}

export function getAgeMs(eventTime: string | null | undefined): number | null {
  if (!eventTime) return null;
  return Date.now() - new Date(eventTime).getTime();
}
