/**
 * klinesClient.ts
 *
 * Fetches historical mark-price kline data from Binance USDT-M Futures.
 * Used to determine the Binance reference price at the last KRX market close
 * (15:30 KST = 06:30 UTC) so the estimate anchor always reflects the most
 * recent trading-day close regardless of baseline.json staleness.
 *
 * Verified response shape (1-minute kline):
 *   [[openTime, open, high, low, close, volume, closeTime,
 *     quoteVolume, count, takerBuyBase, takerBuyQuote, ignore]]
 *
 * Curl examples:
 *   SAMSUNGUSDT, 2026-07-31T06:30Z (startTime=1785479400000):
 *     [[1785479400000,"182.62","183.44","182.62","182.77","0",...]]
 *
 *   SAMSUNGUSDT, 2026-08-07T06:30Z (startTime=1786084200000):
 *     [[1786084200000,"163.70","163.71","163.58","163.59","0",...]]
 */

import { BINANCE_FUTURES_REST_BASE } from "../../config/market";

/**
 * Fetch the open price of the 1-minute mark-price kline whose openTime equals
 * `openTimeMs` (UTC milliseconds).
 *
 * The open price = the mark price at that exact second, making it the ideal
 * anchor for the KRX close at 15:30 KST.
 *
 * Returns null on any network/parse/validation error or if the kline is
 * unavailable (future timestamps, symbol not found, etc.).
 */
export async function fetchMarkPriceAtTime(
  symbol: string,
  openTimeMs: number
): Promise<number | null> {
  const url =
    `${BINANCE_FUTURES_REST_BASE}/fapi/v1/markPriceKlines` +
    `?symbol=${encodeURIComponent(symbol)}&interval=1m` +
    `&startTime=${openTimeMs}&limit=1`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(
        `[klinesClient] HTTP ${res.status} for ${symbol} at ${openTimeMs}`
      );
      return null;
    }

    const rows = (await res.json()) as unknown[][];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const kline = rows[0];
    if (!Array.isArray(kline) || kline.length < 2) return null;

    // Verify Binance returned the exact kline we requested
    const returnedOpenTime = Number(kline[0]);
    if (returnedOpenTime !== openTimeMs) {
      console.warn(
        `[klinesClient] Unexpected kline openTime for ${symbol}: ` +
          `got ${returnedOpenTime}, expected ${openTimeMs}`
      );
      return null;
    }

    // kline[1] = open price (string) — mark price at the exact openTime second
    const price = parseFloat(kline[1] as string);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch (err) {
    console.warn(`[klinesClient] Fetch error for ${symbol}:`, err);
    return null;
  }
}
