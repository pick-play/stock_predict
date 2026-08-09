import type { DataSource, ReferencePriceMode } from "../../types/market";

export interface NormalizedQuote {
  symbol: string;
  lastPrice: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  volume24h: number | null;
  changePercent24h: number | null;
  fundingRate: number | null;
  eventTime: string;
  source: DataSource;
}

export interface MarketDataProvider {
  fetchQuote(symbol: string): Promise<NormalizedQuote>;
  fetchMarkPrice?(symbol: string): Promise<NormalizedQuote>;
  connectStream?(
    symbols: string[],
    onQuote: (quote: NormalizedQuote) => void
  ): () => void;
}

export interface BinanceTickerResponse {
  symbol: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  volume: string;
  priceChangePercent: string;
  time?: number;
}

export interface BinancePremiumIndexResponse {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  time: number;
}

/** Response from /fapi/v1/ticker/24hr — USDT-M Futures 24hr ticker (no bid/ask) */
export interface BinanceFutures24hrTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  closeTime: number;
}

/** Response from /fapi/v1/ticker/bookTicker — USDT-M Futures best bid/ask */
export interface BinanceFuturesBookTicker {
  symbol: string;
  bidPrice: string;
  askPrice: string;
  time: number;
}

/**
 * Raw WebSocket bookTicker message for USDT-M Futures.
 * Verified live 2026-08-09: only @bookTicker emits for SAMSUNGUSDT / SKHYNIXUSDT.
 * @markPrice, @ticker produce no messages for these TradFi symbols.
 * Combined-stream envelope: { stream: "samsungusdt@bookTicker", data: BinanceFuturesBookTickerWS }
 */
export interface BinanceFuturesBookTickerWS {
  e: "bookTicker";
  u: number;   // update id
  s: string;   // symbol e.g. "SAMSUNGUSDT"
  ps: string;  // pair
  b: string;   // best bid price
  B: string;   // best bid qty
  a: string;   // best ask price
  A: string;   // best ask qty
  T: number;   // transaction time (ms)
  E: number;   // event time (ms)
  st?: number; // undocumented field observed in live messages
}

export function selectReferencePrice(
  quote: NormalizedQuote,
  mode: ReferencePriceMode
): number | null {
  switch (mode) {
    case "mark":
      if (quote.markPrice !== null && quote.markPrice > 0) return quote.markPrice;
      break;
    case "mid":
      if (
        quote.bidPrice !== null &&
        quote.askPrice !== null &&
        quote.bidPrice > 0 &&
        quote.askPrice > 0 &&
        quote.bidPrice <= quote.askPrice
      ) {
        return (quote.bidPrice + quote.askPrice) / 2;
      }
      break;
    case "last":
      if (quote.lastPrice !== null && quote.lastPrice > 0) return quote.lastPrice;
      break;
  }

  // Fallback chain
  if (quote.markPrice !== null && quote.markPrice > 0) return quote.markPrice;
  if (
    quote.bidPrice !== null &&
    quote.askPrice !== null &&
    quote.bidPrice > 0 &&
    quote.askPrice > 0 &&
    quote.bidPrice <= quote.askPrice
  ) {
    return (quote.bidPrice + quote.askPrice) / 2;
  }
  if (quote.lastPrice !== null && quote.lastPrice > 0) return quote.lastPrice;

  return null;
}
