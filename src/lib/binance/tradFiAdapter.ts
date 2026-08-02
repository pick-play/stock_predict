import type { MarketDataProvider, NormalizedQuote, BinanceTickerResponse } from "./types";
import { normalizeTicker } from "./normalizer";
import { BINANCE_REST_BASE } from "../../config/market";

/**
 * Adapter for Binance TradFi products (SAMSUNGUSDT, SKHYNIXUSDT etc.)
 * These are spot-like products, not futures, so we use the spot ticker endpoint.
 */
export class TradFiAdapter implements MarketDataProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = BINANCE_REST_BASE) {
    this.baseUrl = baseUrl;
  }

  async fetchQuote(symbol: string): Promise<NormalizedQuote> {
    const url = `${this.baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `TradFi REST error for ${symbol}: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as BinanceTickerResponse;

    if (!data.symbol || data.symbol !== symbol) {
      throw new Error(`Symbol mismatch: expected ${symbol}, got ${data.symbol}`);
    }

    // Validate bid <= ask
    const bid = parseFloat(data.bidPrice);
    const ask = parseFloat(data.askPrice);
    if (
      Number.isFinite(bid) &&
      Number.isFinite(ask) &&
      bid > 0 &&
      ask > 0 &&
      bid > ask
    ) {
      console.warn(`[TradFiAdapter] Bid > Ask for ${symbol}: bid=${bid} ask=${ask}`);
      data.bidPrice = "0";
      data.askPrice = "0";
    }

    return normalizeTicker(data, "binance-rest");
  }
}

export const tradFiAdapter = new TradFiAdapter();
