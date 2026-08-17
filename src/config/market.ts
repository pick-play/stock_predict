export const CLIENT_REFRESH_INTERVAL_MS = 60_000;

/**
 * How often a phone re-reads the futures price over REST.
 *
 * Measured, not guessed: the bookTicker socket the desktop uses delivers 103.8
 * frames per second for these two symbols — 653 KB every 30 seconds, roughly
 * 78 MB an hour, and about a hundred JSON parses a second. Rendering is batched
 * to 1s, but the receiving is not, and a modem fed a hundred packets a second
 * never returns to idle. That is the heat.
 *
 * markPrice, ticker and aggTrade were all probed and emit nothing for TradFi
 * symbols, so there is no slower stream to switch to. Polling is the only lever:
 * two 153-byte responses every few seconds is about 0.7 MB an hour and lets the
 * radio sleep in between.
 *
 * Four seconds keeps the reading current enough for an overnight reference price
 * while cutting the traffic by two orders of magnitude.
 */
export const MOBILE_QUOTE_POLL_INTERVAL_MS = 4_000;

export const STALE_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
export const STALE_CRITICAL_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export const MAX_CHANGE_RATE = 0.3; // 30% max single-update change
export const MIN_PRICE_RATIO = 0.5;
export const MAX_PRICE_RATIO = 2.0;

export const KRX_TIMEZONE = "Asia/Seoul";

export const KRX_OPEN_HOUR = 9;
export const KRX_OPEN_MINUTE = 0;
export const KRX_CLOSE_HOUR = 15;
export const KRX_CLOSE_MINUTE = 30;

export const HISTORY_MAX_RECENT_DAYS = 7;
export const HISTORY_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;

// Use import.meta.env.BASE_URL so paths work on GitHub Pages (e.g. /stock_predict/)
// Vite sets BASE_URL to "/" in dev and to the configured base in production builds.
export const BASELINE_PATH = `${import.meta.env.BASE_URL}data/baseline.json`;
export const LATEST_PATH = `${import.meta.env.BASE_URL}data/latest.json`;
export const HISTORY_PATH = `${import.meta.env.BASE_URL}data/history.json`;


// Browser refresh cadence for history.json (charts/sparklines) — matches the
// 5-minute GitHub Actions data commit interval.
export const HISTORY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Oldest a stored snapshot may be and still stand in for a live price.
//
// latest.json is only reached when every live quote failed, and its writer
// (update-market-data.yml) is disabled, so the committed copy can be days or
// weeks old. Showing that as the current price would break the rule that stale
// financial data is never presented as normal — past this age the cards show
// the "데이터 확인 중" state instead of a number nobody should act on.
export const FALLBACK_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";

// USDT-M Futures endpoints (fapi.binance.com / fstream.binance.com)
export const BINANCE_FUTURES_REST_BASE = "https://fapi.binance.com";
export const BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com";
