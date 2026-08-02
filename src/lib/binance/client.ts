import type { NormalizedQuote } from "./types";
import { selectReferencePrice } from "./types";
import { tradFiAdapter } from "./tradFiAdapter";
import { MARKET_SYMBOLS } from "../../config/symbols";
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

export async function fetchAllStockQuotes(
  mode: ReferencePriceMode = "mark"
): Promise<Record<StockId, StockQuoteResult>> {
  const stockIds: StockId[] = ["samsung", "skHynix"];
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
