/**
 * githubFallback.ts
 *
 * Fetches latest.json and baseline.json from GitHub with a two-URL fallback:
 *   1. GitHub Pages CDN URL  (same origin, fast — `LATEST_PATH` / `BASELINE_PATH`)
 *   2. raw.githubusercontent.com (absolute, CORS: access-control-allow-origin: *)
 *
 * Used by useMarketData when Binance API is unavailable.
 */

import type { LatestData, Baseline } from "../types/market";
import { LatestDataSchema, BaselineSchema } from "./validation";
import {
  LATEST_PATH,
  BASELINE_PATH,
  GITHUB_RAW_LATEST_URL,
  GITHUB_RAW_BASELINE_URL,
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
 * Fetch latest.json — GitHub Pages first, raw GitHub second.
 * Returns null only if both URLs fail.
 */
export async function fetchGithubLatest(): Promise<FetchResult<LatestData>> {
  // 1. Try GitHub Pages CDN (relative URL, same host as the deployed app).
  const pagesUrl = `${LATEST_PATH}?t=${Date.now()}`;
  const fromPages = await tryFetch<LatestData>(pagesUrl, LatestDataSchema);
  if (fromPages !== null) {
    return fromPages;
  }

  // 2. Fallback to raw.githubusercontent.com (absolute URL, CORS-enabled).
  console.info("[githubFallback] Pages URL failed, trying raw GitHub for latest.json");
  const rawUrl = `${GITHUB_RAW_LATEST_URL}?t=${Date.now()}`;
  return tryFetch<LatestData>(rawUrl, LatestDataSchema);
}

/**
 * Fetch baseline.json — GitHub Pages first, raw GitHub second.
 * Returns null only if both URLs fail.
 */
export async function fetchGithubBaseline(): Promise<FetchResult<Baseline>> {
  // 1. Try GitHub Pages CDN.
  const pagesUrl = `${BASELINE_PATH}?t=${Date.now()}`;
  const fromPages = await tryFetch<Baseline>(pagesUrl, BaselineSchema);
  if (fromPages !== null) {
    return fromPages;
  }

  // 2. Fallback to raw.githubusercontent.com.
  console.info("[githubFallback] Pages URL failed, trying raw GitHub for baseline.json");
  const rawUrl = `${GITHUB_RAW_BASELINE_URL}?t=${Date.now()}`;
  return tryFetch<Baseline>(rawUrl, BaselineSchema);
}
