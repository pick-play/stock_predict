export const CLIENT_REFRESH_INTERVAL_MS = 60_000;

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

// Raw GitHub content URLs as secondary fallback when GitHub Pages CDN is unavailable.
// CORS confirmed: access-control-allow-origin: * on raw.githubusercontent.com.
const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/pick-play/stock_predict/main/public/data";
export const GITHUB_RAW_LATEST_URL = `${GITHUB_RAW_BASE}/latest.json`;
export const GITHUB_RAW_BASELINE_URL = `${GITHUB_RAW_BASE}/baseline.json`;

export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";

// USDT-M Futures endpoints (fapi.binance.com / fstream.binance.com)
export const BINANCE_FUTURES_REST_BASE = "https://fapi.binance.com";
export const BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com";
