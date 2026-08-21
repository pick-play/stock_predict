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
 *
 * Two shapes, for two very different cadences:
 *
 * `fetchQuote(symbol)` is the full picture — three endpoints in parallel for one
 * symbol — and is what the once-a-minute refresh uses:
 *   - /fapi/v1/ticker/24hr   → lastPrice, volume, changePercent   (weight 1)
 *   - /fapi/v1/premiumIndex  → markPrice, indexPrice, fundingRate (weight 1)
 *   - /fapi/v1/ticker/bookTicker → bidPrice, askPrice (optional)  (weight 2)
 *
 * `fetchBookTickers(symbols)` is the live path, and it is one request no matter
 * how many symbols are asked for. See its own comment for why that trade is
 * worth making at poll frequency and not at refresh frequency.
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

  /**
   * Best bid/ask for many symbols in a single request.
   *
   * `/fapi/v1/ticker/bookTicker` with no `symbol` returns every futures symbol
   * at once, so the cost of a poll stops depending on how many stocks the site
   * lists. Going from 2 stocks to 7 turns the per-symbol form into 7 requests
   * every 4 seconds; this stays at 1.
   *
   * `symbols=[...]` is not a way out — fapi accepts the parameter and silently
   * ignores it, returning the full list anyway (verified against the live API),
   * so there is no server-side filter to lean on. The filtering happens here.
   *
   * Measured 2026-08-22 (744 symbols): 112 KB raw, 21.9 KB gzipped on the wire,
   * request weight 5 versus 2 per symbol. That is the whole trade — more bytes
   * per call, far less weight and far fewer calls in total.
   *
   * Returns only bid/ask, exactly like the WebSocket bookTicker stream the
   * desktop uses, so both live feeds hand the app the same shape.
   */
  async fetchBookTickers(
    symbols: string[]
  ): Promise<Map<string, NormalizedQuote>> {
    const wanted = new Set(symbols);
    const out = new Map<string, NormalizedQuote>();
    if (wanted.size === 0) return out;

    const res = await fetch(`${this.baseUrl}/fapi/v1/ticker/bookTicker`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Futures bookTicker (all symbols) error: HTTP ${res.status}`);
    }

    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) {
      throw new Error("Futures bookTicker (all symbols): expected an array");
    }

    for (const row of rows as BinanceFuturesBookTicker[]) {
      if (!row || typeof row.symbol !== "string" || !wanted.has(row.symbol)) {
        continue;
      }

      const bid = parseFloat(row.bidPrice);
      const ask = parseFloat(row.askPrice);
      if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
        continue;
      }
      // An inverted book is a data error, not a tradeable spread.
      if (bid > ask) {
        console.warn(
          `[FuturesAdapter] Bid > Ask for ${row.symbol}: bid=${bid} ask=${ask}`
        );
        continue;
      }

      out.set(row.symbol, {
        symbol: row.symbol,
        lastPrice: null,
        markPrice: null,
        indexPrice: null,
        bidPrice: bid,
        askPrice: ask,
        volume24h: null,
        changePercent24h: null,
        fundingRate: null,
        /*
         * The book's own timestamp, which for a thinly quoted symbol can be
         * many minutes old and has been observed moving backwards. It is
         * reported as-is here; deciding how old the *price* is belongs to the
         * consumer, which also holds the mark-price time from the minute
         * refresh. See the eventTime handling in useMarketData.
         */
        eventTime: new Date(row.time).toISOString(),
        source: "binance-rest",
      });
    }

    return out;
  }
}

export const tradFiAdapter = new FuturesAdapter();
