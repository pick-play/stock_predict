/** Market session state for one instrument on the ticker tape. */
export type TickerMarketStatus = "open" | "closed" | "unknown";

/** One quote as returned by GET /api/markets. */
export interface MarketQuote {
  id: string;
  price: number;
  previousClose: number;
  changePercent: number;
  /** ISO time of the newest datapoint behind `price`. */
  asOf: string;
  status: TickerMarketStatus;
  sessionStart: string | null;
  sessionEnd: string | null;
}

export interface MarketsResponse {
  generatedAt: string;
  quotes: MarketQuote[];
}

/** A quote joined with its display config, ready to render. */
export interface TickerItem {
  id: string;
  label: string;
  price: number;
  changePercent: number;
  decimals: number;
  unit: string;
  status: TickerMarketStatus;
  /** True once the underlying datapoint is older than the tape's threshold. */
  isStale: boolean;
  /** True while the value is coming from the browser's own live socket. */
  isLive: boolean;
}
