/**
 * klineHistory.ts
 *
 * Builds the chart series in the browser instead of reading it from the
 * repository. GitHub-hosted runners are answered with HTTP 451 by the futures
 * API, so the scheduled collector never accumulates history; a reader's own
 * connection is not blocked, so the same candles are fetched here and converted
 * with the session anchor the cards already use.
 */

import type { HistoryEntry, StockId } from "../../types/market";
import { calculateEstimate } from "../calculateEstimate";
import { MARKET_SYMBOLS } from "../../config/symbols";
import { BINANCE_FUTURES_REST_BASE } from "../../config/market";

export type ChartRange = "1h" | "6h" | "24h" | "7d";

/** Candle size per range, chosen so every range lands near 60–170 points. */
const RANGE_QUERY: Record<ChartRange, { interval: string; limit: number }> = {
  "1h": { interval: "1m", limit: 60 },
  "6h": { interval: "5m", limit: 72 },
  "24h": { interval: "15m", limit: 96 },
  "7d": { interval: "1h", limit: 168 },
};

/** Anchor pair needed to express a futures price as an estimated KRW price. */
export interface StockAnchor {
  krxPrice: number;
  anchorFuturesPrice: number;
}

interface Candle {
  openTime: number;
  close: number;
}

async function fetchCandles(
  symbol: string,
  range: ChartRange,
  signal?: AbortSignal
): Promise<Candle[] | null> {
  const { interval, limit } = RANGE_QUERY[range];
  const url =
    `${BINANCE_FUTURES_REST_BASE}/fapi/v1/markPriceKlines` +
    `?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[klineHistory] HTTP ${res.status} for ${symbol} ${range}`);
      return null;
    }

    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows)) return null;

    const candles: Candle[] = [];
    for (const row of rows) {
      // [openTime, open, high, low, close, ...]
      if (!Array.isArray(row) || row.length < 5) continue;
      const openTime = Number(row[0]);
      const close = parseFloat(String(row[4]));
      if (Number.isFinite(openTime) && Number.isFinite(close) && close > 0) {
        candles.push({ openTime, close });
      }
    }
    return candles.length > 0 ? candles : null;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return null;
    console.warn(`[klineHistory] Fetch error for ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetch both stocks for one range and merge them into the shape the chart and
 * sparklines already consume. Stocks without a usable anchor are left out
 * rather than plotted against a guessed reference.
 */
export async function fetchKlineHistory(
  range: ChartRange,
  anchors: Partial<Record<StockId, StockAnchor>>,
  signal?: AbortSignal
): Promise<HistoryEntry[] | null> {
  const stockIds = (Object.keys(anchors) as StockId[]).filter((id) => {
    const a = anchors[id];
    return a !== undefined && a.krxPrice > 0 && a.anchorFuturesPrice > 0;
  });
  if (stockIds.length === 0) return null;

  const settled = await Promise.allSettled(
    stockIds.map((id) =>
      fetchCandles(MARKET_SYMBOLS[id].binanceSymbol, range, signal)
    )
  );

  // Bucket by candle open time so both stocks share one x-axis point.
  const byTime = new Map<number, HistoryEntry["stocks"]>();

  settled.forEach((result, i) => {
    const candles = result.status === "fulfilled" ? result.value : null;
    if (!candles) return;

    const stockId = stockIds[i];
    const anchor = anchors[stockId]!;

    for (const candle of candles) {
      let estimate;
      try {
        estimate = calculateEstimate({
          krxClose: anchor.krxPrice,
          currentBinancePrice: candle.close,
          baselineBinancePrice: anchor.anchorFuturesPrice,
        });
      } catch {
        continue;
      }

      const bucket = byTime.get(candle.openTime) ?? {};
      bucket[stockId] = {
        estimatedPrice: estimate.estimatedPrice,
        changeRate: estimate.changeRate,
        currentBinancePrice: candle.close,
      };
      byTime.set(candle.openTime, bucket);
    }
  });

  if (byTime.size === 0) return null;

  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([openTime, stocks]) => ({
      timestamp: new Date(openTime).toISOString(),
      stocks,
    }));
}
