import type { MarketDataProvider, NormalizedQuote, BinanceTickerResponse } from "./types";
import { normalizeTicker } from "./normalizer";
import { BINANCE_REST_BASE } from "../../config/market";

export class BinanceRestAdapter implements MarketDataProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = BINANCE_REST_BASE) {
    this.baseUrl = baseUrl;
  }

  async fetchQuote(symbol: string): Promise<NormalizedQuote> {
    const tickerUrl = `${this.baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;

    const response = await fetch(tickerUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `Binance REST error for ${symbol}: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as BinanceTickerResponse;

    if (!data.symbol || data.symbol !== symbol) {
      throw new Error(`Symbol mismatch: expected ${symbol}, got ${data.symbol}`);
    }

    return normalizeTicker(data, "binance-rest");
  }
}

export const binanceRestAdapter = new BinanceRestAdapter();
