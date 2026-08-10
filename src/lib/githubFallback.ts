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
  FALLBACK_MAX_AGE_MS,
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

/**
 * Fetch latest.json, the last-resort stand-in for a live quote.
 *
 * Rejected once older than FALLBACK_MAX_AGE_MS. The scheduled writer is
 * disabled, so the committed snapshot ages indefinitely; handing a days-old
 * price to the cards would render it in the same "healthy" styling as a live
 * one. Returning null instead leaves the caller in its data-unavailable state,
 * which says so plainly.
 */
export async function fetchGithubLatest(): Promise<FetchResult<LatestData>> {
  const data = await fetchSameOrigin<LatestData>(
    LATEST_PATH,
    LatestDataSchema,
    "latest.json"
  );
  if (data === null) return null;

  // A timestamp far in the future is as untrustworthy as a stale one: it means
  // a broken clock somewhere, and the age check would wave it through.
  const ageMs = Date.now() - new Date(data.generatedAt).getTime();
  if (
    !Number.isFinite(ageMs) ||
    ageMs > FALLBACK_MAX_AGE_MS ||
    ageMs < -FALLBACK_MAX_AGE_MS
  ) {
    console.warn(
      `[dataFetch] latest.json too old to stand in for a live price ` +
        `(generatedAt=${data.generatedAt}, age=${Math.round(ageMs / 60_000)}분)`
    );
    return null;
  }

  return data;
}

/** Fetch baseline.json. Returns null only if both URLs fail. */
export async function fetchGithubBaseline(): Promise<FetchResult<Baseline>> {
  return fetchSameOrigin<Baseline>(
    BASELINE_PATH,
    BaselineSchema,
    "baseline.json"
  );
}

/**
 * Fetch history.json for charts/sparklines. Returns null only if both URLs fail.
 *
 * Per-stock entries priced at zero are dropped. The collector wrote one such
 * record before it was disabled, and a zero is not a low price — plotted as-is
 * it drags the series down to the axis and reads as a crash that never happened.
 */
export async function fetchGithubHistory(): Promise<FetchResult<HistoryEntry[]>> {
  // ValidatedHistoryEntry has optional per-stock fields (Zod schema);
  // HistoryEntry uses Record<StockId, ...>. The shapes are runtime-compatible —
  // same cast pattern the original inline fetch used (`result.data as HistoryEntry[]`).
  const data = await fetchSameOrigin<ValidatedHistoryEntry[]>(
    HISTORY_PATH,
    HistoryArraySchema,
    "history.json"
  );
  if (data === null) return null;

  const cleaned = data
    .map((entry) => {
      const stocks = Object.fromEntries(
        Object.entries(entry.stocks).filter(
          ([, snapshot]) => (snapshot?.estimatedPrice ?? 0) > 0
        )
      );
      return { ...entry, stocks };
    })
    .filter((entry) => Object.keys(entry.stocks).length > 0);

  return cleaned as HistoryEntry[];
}
