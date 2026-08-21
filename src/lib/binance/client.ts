import type { NormalizedQuote } from "./types";
import { selectReferencePrice } from "./types";
import { tradFiAdapter } from "./tradFiAdapter";
import { MARKET_SYMBOLS, STOCK_IDS } from "../../config/symbols";
import type { StockId, ReferencePriceMode } from "../../types/market";

export interface StockQuoteResult {
  stockId: StockId;
  quote: NormalizedQuote | null;
  referencePrice: number | null;
  error: string | null;
}

export async function fetchStockQuote(
  stockId: StockId,
  mode: ReferencePriceMode = "mark"
): Promise<StockQuoteResult> {
  const config = MARKET_SYMBOLS[stockId];
  if (!config) {
    return {
      stockId,
      quote: null,
      referencePrice: null,
      error: `Unknown stock ID: ${stockId}`,
    };
  }

  try {
    const quote = await tradFiAdapter.fetchQuote(config.binanceSymbol);
    const referencePrice = selectReferencePrice(quote, mode);

    return {
      stockId,
      quote,
      referencePrice,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[BinanceClient] Failed to fetch ${config.binanceSymbol}:`, message);
    return {
      stockId,
      quote: null,
      referencePrice: null,
      error: message,
    };
  }
}

/** One bid/ask read covering every listed stock, in a single HTTP request. */
export interface BookQuoteResult {
  /** Keyed by stock id; a stock missing from the response is simply absent. */
  quotes: Partial<Record<StockId, NormalizedQuote>>;
  error: string | null;
}

/**
 * Live bid/ask for the given stocks — **one** HTTP request regardless of how
 * many are asked for.
 *
 * This is the poll path a phone runs every few seconds, so its cost has to be
 * flat in the number of listings. `fetchStockQuote` costs three requests per
 * stock, which at 7 stocks is 21 requests every 4 seconds; this is 1.
 *
 * It deliberately returns bid/ask only. The poll's consumer reprices from the
 * book mid and reads nothing else off these quotes, and the mark/volume/24h
 * fields are already supplied once a minute by `fetchStockQuote`. Fetching the
 * all-symbols premiumIndex and 24hr responses at poll frequency would add
 * ~84 KB gzipped and 50 request-weight to every single poll to refresh fields
 * nobody reads that often.
 *
 * A failed request throws nothing away: it reports `error` and an empty map, so
 * the caller keeps the prices it already has rather than blanking the cards.
 */
export async function fetchBookQuotes(
  stockIds: readonly StockId[] = STOCK_IDS
): Promise<BookQuoteResult> {
  const symbolToId = new Map<string, StockId>();
  for (const id of stockIds) {
    const config = MARKET_SYMBOLS[id];
    if (config) symbolToId.set(config.binanceSymbol, id);
  }

  try {
    const bySymbol = await tradFiAdapter.fetchBookTickers([...symbolToId.keys()]);

    const quotes: Partial<Record<StockId, NormalizedQuote>> = {};
    for (const [symbol, quote] of bySymbol) {
      const id = symbolToId.get(symbol);
      if (id) quotes[id] = quote;
    }

    return { quotes, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[BinanceClient] Batched bookTicker read failed:", message);
    return { quotes: {}, error: message };
  }
}

export async function fetchAllStockQuotes(
  mode: ReferencePriceMode = "mark"
): Promise<Record<StockId, StockQuoteResult>> {
  const stockIds = STOCK_IDS;
  const results = await Promise.allSettled(
    stockIds.map((id) => fetchStockQuote(id, mode))
  );

  const output = {} as Record<StockId, StockQuoteResult>;
  results.forEach((result, i) => {
    const id = stockIds[i];
    if (result.status === "fulfilled") {
      output[id] = result.value;
    } else {
      output[id] = {
        stockId: id,
        quote: null,
        referencePrice: null,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    }
  });

  return output;
}
