import type { NormalizedQuote } from "./types";
import type { BinanceTickerResponse, BinancePremiumIndexResponse } from "./types";

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
