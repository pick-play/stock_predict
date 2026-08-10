/**
 * Display configuration for the ticker tape.
 *
 * The Worker decides which symbols exist and what they are worth; this file
 * decides only how they read on screen. Keeping the two apart means a label or
 * decimal change never touches the data path.
 *
 * Order here is the order on the tape.
 */

export type TickerSource = "yahoo" | "binance-ws";

export interface TickerInstrument {
  /** Matches MarketQuote.id from GET /api/markets. */
  id: string;
  label: string;
  /** Digits after the decimal point. Index points and dollars differ. */
  decimals: number;
  /** Rendered after the number, smaller. Empty for plain index points. */
  unit: string;
  /**
   * Where the live value comes from.
   *
   * "yahoo" values arrive through the Worker proxy and lag the market by
   * roughly a quarter hour. "binance-ws" is a genuine live feed the browser
   * holds open itself, so it is the only entry the tape can call 실시간.
   */
  source: TickerSource;
  /** Binance symbol for the live stream. Only set when source is binance-ws. */
  binanceSymbol?: string;
}

export const TICKER_INSTRUMENTS: readonly TickerInstrument[] = [
  { id: "kospi", label: "코스피", decimals: 2, unit: "", source: "yahoo" },
  { id: "kosdaq", label: "코스닥", decimals: 2, unit: "", source: "yahoo" },
  { id: "nasdaq100", label: "나스닥 100", decimals: 2, unit: "", source: "yahoo" },
  { id: "sp500", label: "S&P 500", decimals: 2, unit: "", source: "yahoo" },
  { id: "dow", label: "다우", decimals: 2, unit: "", source: "yahoo" },
  {
    id: "bitcoin",
    label: "비트코인",
    decimals: 0,
    unit: "USD",
    source: "binance-ws",
    binanceSymbol: "BTCUSDT",
  },
  { id: "gold", label: "금", decimals: 2, unit: "USD/oz", source: "yahoo" },
  { id: "oil", label: "WTI유", decimals: 2, unit: "USD/bbl", source: "yahoo" },
  { id: "dollar", label: "달러지수", decimals: 2, unit: "", source: "yahoo" },
  { id: "ust10y", label: "미 10년물", decimals: 3, unit: "%", source: "yahoo" },
] as const;

/** How often the tape re-reads the Worker. The Worker itself caches for 15s. */
export const TICKER_REFRESH_INTERVAL_MS = 30_000;

/**
 * Age past which the upstream is treated as having stopped, not merely lagging.
 *
 * Every Yahoo-sourced instrument is behind by roughly a quarter hour even mid
 * session, so an open market is always badged 지연 — never 장중, which would
 * read as "this is the current price". This threshold marks the different
 * failure above it: the feed itself has stalled, badged 갱신 중단. Deliberately
 * looser than the 5-minute threshold used for the futures-driven cards, whose
 * prices really are live.
 */
export const TICKER_STALE_THRESHOLD_MS = 30 * 60 * 1000;
