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

export const BASELINE_PATH = "/data/baseline.json";
export const LATEST_PATH = "/data/latest.json";
export const HISTORY_PATH = "/data/history.json";

export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";
