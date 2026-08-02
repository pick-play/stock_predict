import type {
  MarketDataProvider,
  NormalizedQuote,
  BinanceFutures24hrTicker,
  BinanceFuturesBookTicker,
  BinancePremiumIndexResponse,
} from "./types";
import { normalizeFuturesTicker } from "./normalizer";
import { BINANCE_FUTURES_REST_BASE } from "../../config/market";

/**
 * Adapter for Binance USDT-M Futures (SAMSUNGUSDT, SKHYNIXUSDT etc.)
 * Fetches three endpoints in parallel:
 *   - /fapi/v1/ticker/24hr   → lastPrice, volume, changePercent
 *   - /fapi/v1/premiumIndex  → markPrice, indexPrice, fundingRate
 *   - /fapi/v1/ticker/bookTicker → bidPrice, askPrice (optional)
 */
export class FuturesAdapter implements MarketDataProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = BINANCE_FUTURES_REST_BASE) {
    this.baseUrl = baseUrl;
  }

  async fetchQuote(symbol: string): Promise<NormalizedQuote> {
    const sym = encodeURIComponent(symbol);

    const [tickerRes, premiumRes, bookRes] = await Promise.allSettled([
      fetch(`${this.baseUrl}/fapi/v1/ticker/24hr?symbol=${sym}`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${this.baseUrl}/fapi/v1/premiumIndex?symbol=${sym}`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${this.baseUrl}/fapi/v1/ticker/bookTicker?symbol=${sym}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    ]);

    if (tickerRes.status === "rejected" || !tickerRes.value.ok) {
      const reason =
        tickerRes.status === "rejected"
          ? String(tickerRes.reason)
          : `HTTP ${tickerRes.value.status}`;
      throw new Error(`Futures 24hr ticker error for ${symbol}: ${reason}`);
    }

    if (premiumRes.status === "rejected" || !premiumRes.value.ok) {
      const reason =
        premiumRes.status === "rejected"
          ? String(premiumRes.reason)
          : `HTTP ${premiumRes.value.status}`;
      throw new Error(`Futures premiumIndex error for ${symbol}: ${reason}`);
    }

    const ticker = (await tickerRes.value.json()) as BinanceFutures24hrTicker;
    const premiumIndex = (await premiumRes.value.json()) as BinancePremiumIndexResponse;

    if (ticker.symbol !== symbol) {
      throw new Error(`Symbol mismatch: expected ${symbol}, got ${ticker.symbol}`);
    }

    let bookTicker: BinanceFuturesBookTicker | null = null;
    if (bookRes.status === "fulfilled" && bookRes.value.ok) {
      const raw = (await bookRes.value.json()) as BinanceFuturesBookTicker;
      const bid = parseFloat(raw.bidPrice);
      const ask = parseFloat(raw.askPrice);
      if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0 && bid > ask) {
        console.warn(`[FuturesAdapter] Bid > Ask for ${symbol}: bid=${bid} ask=${ask}`);
      } else {
        bookTicker = raw;
      }
    }

    return normalizeFuturesTicker(ticker, premiumIndex, bookTicker, "binance-rest");
  }
}

export const tradFiAdapter = new FuturesAdapter();
