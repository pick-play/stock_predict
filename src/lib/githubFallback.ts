/**
 * dataFetch (githubFallback.ts)
 *
 * Loads baseline.json / latest.json / history.json from this site's own origin.
 *
 * baseline.json supplies the anchor the cards and chart are priced from.
 * latest.json and history.json are only fallbacks: live prices come straight
 * from the futures API and the chart builds its series from candles.
 */

import type { LatestData, Baseline, HistoryEntry } from "../types/market";
import {
  LatestDataSchema,
  BaselineSchema,
  HistoryArraySchema,
  type ValidatedHistoryEntry,
} from "./validation";
import {
  LATEST_PATH,
  BASELINE_PATH,
  HISTORY_PATH,
} from "../config/market";

type FetchResult<T> = T | null;

/**
 * Try one URL and parse the JSON with the given Zod schema.
 * Returns null on any fetch/parse/validation error.
 */
async function tryFetch<T>(
  url: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T } }
): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[githubFallback] HTTP ${res.status} from ${url}`);
      return null;
    }
    const json: unknown = await res.json();
    const result = schema.safeParse(json);
    if (!result.success) {
      console.warn(`[githubFallback] Schema validation failed for ${url}`);
      return null;
    }
    return result.data as T;
  } catch (err) {
    console.warn(`[githubFallback] Fetch error for ${url}:`, err);
    return null;
  }
}

/**
 * Data is read from this site's own origin only.
 *
 * An earlier version fetched raw.githubusercontent directly, which put the
 * account and repository name into the shipped bundle for anyone who opened
 * the network tab. Freshness is preserved instead by letting a data commit
 * trigger a Pages rebuild, so the copy served here is the committed one.
 */
async function fetchSameOrigin<T>(
  path: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T } },
  label: string
): Promise<FetchResult<T>> {
  const result = await tryFetch<T>(`${path}?t=${Date.now()}`, schema);
  if (result === null) {
    console.info(`[dataFetch] ${label}: unavailable`);
  }
  return result;
}

/** Fetch latest.json. Returns null only if both URLs fail. */
export async function fetchGithubLatest(): Promise<FetchResult<LatestData>> {
  return fetchSameOrigin<LatestData>(
    LATEST_PATH,
    LatestDataSchema,
    "latest.json"
  );
}

/** Fetch baseline.json. Returns null only if both URLs fail. */
export async function fetchGithubBaseline(): Promise<FetchResult<Baseline>> {
  return fetchSameOrigin<Baseline>(
    BASELINE_PATH,
    BaselineSchema,
    "baseline.json"
  );
}

/** Fetch history.json for charts/sparklines. Returns null only if both URLs fail. */
export async function fetchGithubHistory(): Promise<FetchResult<HistoryEntry[]>> {
  // ValidatedHistoryEntry has optional per-stock fields (Zod schema);
  // HistoryEntry uses Record<StockId, ...>. The shapes are runtime-compatible —
  // same cast pattern the original inline fetch used (`result.data as HistoryEntry[]`).
  const data = await fetchSameOrigin<ValidatedHistoryEntry[]>(
    HISTORY_PATH,
    HistoryArraySchema,
    "history.json"
  );
  return data as HistoryEntry[] | null;
}
