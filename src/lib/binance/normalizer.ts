import type { NormalizedQuote } from "./types";
import type {
  BinanceTickerResponse,
  BinancePremiumIndexResponse,
  BinanceFutures24hrTicker,
  BinanceFuturesBookTicker,
} from "./types";

export function normalizeTicker(
  ticker: BinanceTickerResponse,
  source: NormalizedQuote["source"] = "binance-rest"
): NormalizedQuote {
  const parsePrice = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    symbol: ticker.symbol,
    lastPrice: parsePrice(ticker.lastPrice),
    markPrice: null,
    indexPrice: null,
    bidPrice: parsePrice(ticker.bidPrice),
    askPrice: parsePrice(ticker.askPrice),
    volume24h: parseFloat(ticker.volume) || null,
    changePercent24h: parseFloat(ticker.priceChangePercent) || null,
    fundingRate: null,
    eventTime: ticker.time
      ? new Date(ticker.time).toISOString()
      : new Date().toISOString(),
    source,
  };
}

/**
 * Normalizes USDT-M Futures data from three parallel endpoints:
 *   - /fapi/v1/ticker/24hr (lastPrice, volume, changePercent — no bid/ask)
 *   - /fapi/v1/premiumIndex (markPrice, indexPrice, fundingRate)
 *   - /fapi/v1/ticker/bookTicker (bidPrice, askPrice — optional)
 */
export function normalizeFuturesTicker(
  ticker: BinanceFutures24hrTicker,
  premiumIndex: BinancePremiumIndexResponse,
  bookTicker: BinanceFuturesBookTicker | null,
  source: NormalizedQuote["source"] = "binance-rest"
): NormalizedQuote {
  const parsePrice = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    symbol: premiumIndex.symbol,
    lastPrice: parsePrice(ticker.lastPrice),
    markPrice: parsePrice(premiumIndex.markPrice),
    indexPrice: parsePrice(premiumIndex.indexPrice),
    bidPrice: bookTicker ? parsePrice(bookTicker.bidPrice) : null,
    askPrice: bookTicker ? parsePrice(bookTicker.askPrice) : null,
    volume24h: parseFloat(ticker.volume) || null,
    changePercent24h: parseFloat(ticker.priceChangePercent) || null,
    fundingRate: parseFloat(premiumIndex.lastFundingRate) || null,
    eventTime: new Date(premiumIndex.time).toISOString(),
    source,
  };
}

export function normalizePremiumIndex(
  pi: BinancePremiumIndexResponse,
  ticker: BinanceTickerResponse | null,
  source: NormalizedQuote["source"] = "binance-rest"
): NormalizedQuote {
  const parsePrice = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    symbol: pi.symbol,
    lastPrice: ticker ? parsePrice(ticker.lastPrice) : null,
    markPrice: parsePrice(pi.markPrice),
    indexPrice: parsePrice(pi.indexPrice),
    bidPrice: ticker ? parsePrice(ticker.bidPrice) : null,
    askPrice: ticker ? parsePrice(ticker.askPrice) : null,
    volume24h: ticker ? (parseFloat(ticker.volume) || null) : null,
    changePercent24h: ticker ? (parseFloat(ticker.priceChangePercent) || null) : null,
    fundingRate: parseFloat(pi.lastFundingRate) || null,
    eventTime: new Date(pi.time).toISOString(),
    source,
  };
}
