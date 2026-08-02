/**
 * githubFallback.ts
 *
 * Fetches latest.json / baseline.json / history.json from GitHub with an
 * ordered two-URL strategy.
 *
 * Production order (raw FIRST):
 *   1. raw.githubusercontent.com — reflects every 5-minute data commit
 *      (deploy-pages.yml ignores public/data/**, so the Pages copies are
 *      frozen at the last code deploy). CORS: access-control-allow-origin: *.
 *   2. GitHub Pages CDN (relative URL) — same-origin backup if raw fails.
 *
 * Dev order (local FIRST):
 *   1. Local dev server relative URL (public/data/**) so local edits win.
 *   2. raw.githubusercontent.com as backup.
 *
 * Used by useMarketData when the Binance API is unavailable and by
 * DashboardPage for chart/sparkline history.
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
  GITHUB_RAW_LATEST_URL,
  GITHUB_RAW_BASELINE_URL,
  GITHUB_RAW_HISTORY_URL,
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
 * Ordered candidate URLs for one data file.
 * Production prefers raw (fresh, updated every data commit); dev prefers the
 * local dev-server copy so local edits are visible without pushing.
 */
export function orderedDataUrls(rawUrl: string, pagesPath: string): string[] {
  return import.meta.env.PROD ? [rawUrl, pagesPath] : [pagesPath, rawUrl];
}

async function fetchWithFallback<T>(
  rawUrl: string,
  pagesPath: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T } },
  label: string
): Promise<FetchResult<T>> {
  const candidates = orderedDataUrls(rawUrl, pagesPath);
  for (const base of candidates) {
    const result = await tryFetch<T>(`${base}?t=${Date.now()}`, schema);
    if (result !== null) return result;
    console.info(`[githubFallback] ${label}: ${base} failed, trying next source`);
  }
  return null;
}

/** Fetch latest.json. Returns null only if both URLs fail. */
export async function fetchGithubLatest(): Promise<FetchResult<LatestData>> {
  return fetchWithFallback<LatestData>(
    GITHUB_RAW_LATEST_URL,
    LATEST_PATH,
    LatestDataSchema,
    "latest.json"
  );
}

/** Fetch baseline.json. Returns null only if both URLs fail. */
export async function fetchGithubBaseline(): Promise<FetchResult<Baseline>> {
  return fetchWithFallback<Baseline>(
    GITHUB_RAW_BASELINE_URL,
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
  const data = await fetchWithFallback<ValidatedHistoryEntry[]>(
    GITHUB_RAW_HISTORY_URL,
    HISTORY_PATH,
    HistoryArraySchema,
    "history.json"
  );
  return data as HistoryEntry[] | null;
}
