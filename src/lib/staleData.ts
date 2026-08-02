import { STALE_WARNING_THRESHOLD_MS, STALE_CRITICAL_THRESHOLD_MS } from "../config/market";

export type DataFreshness = "fresh" | "warning" | "stale" | "unknown";

export function getDataFreshness(eventTime: string | null | undefined): DataFreshness {
  if (!eventTime) return "unknown";
  const age = Date.now() - new Date(eventTime).getTime();
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
