/**
 * Fetches market data from Binance USDT-M Futures and updates public/data/latest.json
 * Run: node scripts/fetch-market-data.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");

const SYMBOLS = {
  samsung: { displayName: "삼성전자", koreanTicker: "005930", binanceSymbol: "SAMSUNGUSDT" },
  skHynix: { displayName: "SK하이닉스", koreanTicker: "000660", binanceSymbol: "SKHYNIXUSDT" },
};

// USDT-M Futures REST base
const BINANCE_FUTURES_REST = "https://fapi.binance.com";

async function fetchFutures24hr(symbol) {
  const url = `${BINANCE_FUTURES_REST}/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for futures 24hr ${symbol}`);
  return res.json();
}

async function fetchPremiumIndex(symbol) {
  const url = `${BINANCE_FUTURES_REST}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for premiumIndex ${symbol}`);
  return res.json();
}

async function fetchBookTicker(symbol) {
  const url = `${BINANCE_FUTURES_REST}/fapi/v1/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  return res.json();
}

function parsePositive(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Select reference price from USDT-M futures data.
 * Supports "mark" (markPrice from premiumIndex), "mid" (bid+ask)/2, "last" (lastPrice).
 * Falls back through mark → mid → last.
 */
function selectReferencePrice(ticker, premiumIndex, bookTicker, mode = "mark") {
  const markPrice = parsePositive(premiumIndex?.markPrice);
  const lastPrice = parsePositive(ticker.lastPrice);
  const bid = parsePositive(bookTicker?.bidPrice);
  const ask = parsePositive(bookTicker?.askPrice);
  const midValid = bid && ask && bid <= ask;

  if (mode === "mark" && markPrice) return markPrice;
  if (mode === "mid" && midValid) return (bid + ask) / 2;
  if (mode === "last" && lastPrice) return lastPrice;

  // Fallback chain: mark → mid → last
  if (markPrice) return markPrice;
  if (midValid) return (bid + ask) / 2;
  if (lastPrice) return lastPrice;
  return null;
}

function roundHalfUp(v) {
  return Math.floor(v + 0.5 + Number.EPSILON);
}

function getKrxTickSize(price) {
  if (price < 1_000) return 1;
  if (price < 5_000) return 5;
  if (price < 10_000) return 10;
  if (price < 50_000) return 50;
  if (price < 100_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

function roundToKrxTick(price) {
  let tick = getKrxTickSize(price);
  let rounded = roundHalfUp(price / tick) * tick;
  const adjustedTick = getKrxTickSize(rounded);
  if (adjustedTick !== tick) {
    rounded = roundHalfUp(price / adjustedTick) * adjustedTick;
  }
  return rounded;
}

function loadBaseline() {
  const path = join(DATA_DIR, "baseline.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function loadLatest() {
  const path = join(DATA_DIR, "latest.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// Check whether the current time in Seoul is a weekend day
function isWeekendInKorea() {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date());
  return day === "Sat" || day === "Sun";
}

/**
 * Multi-factor confidence score — mirrors browser src/lib/confidenceScore.ts.
 * Now handles USDT-M Futures: markPrice is real (not always absent).
 */
function calculateConfidenceScore({ ticker, premiumIndex, bookTicker, baselineStock }) {
  let score = 100;

  // Data age (use premiumIndex.time — updated every 8 hours on funding intervals,
  // but typically reflects real-time mark price update time)
  const eventTime =
    typeof premiumIndex?.time === "number" ? premiumIndex.time : Date.now();
  const ageMs = Date.now() - eventTime;
  if (ageMs > 60_000) score -= 10;
  if (ageMs > 5 * 60_000) score -= 30;

  // Bid/ask spread (from bookTicker)
  const bid = parsePositive(bookTicker?.bidPrice);
  const ask = parsePositive(bookTicker?.askPrice);
  if (bid !== null && ask !== null && bid <= ask) {
    const spread = (ask - bid) / ask;
    if (spread > 0.005) score -= 10;
  } else {
    score -= 10; // no valid bid/ask
  }

  // 24h volume — low liquidity penalty
  const vol24h = parseFloat(ticker.volume);
  if (Number.isFinite(vol24h) && vol24h < 1000) score -= 15;

  // markPrice availability (USDT-M futures has markPrice; deduct only if missing)
  const markPrice = parsePositive(premiumIndex?.markPrice);
  if (markPrice === null) score -= 10;

  // Baseline availability
  if (
    !baselineStock ||
    !(baselineStock.krxClose > 0) ||
    !(baselineStock.binanceReferencePrice > 0)
  ) {
    score -= 25;
  }

  // Weekend: lower liquidity and wider spreads
  if (isWeekendInKorea()) score -= 10;

  return Math.max(0, Math.min(100, score));
}

async function main() {
  console.log("[fetch-market-data] Starting (USDT-M Futures)...");

  const baseline = loadBaseline();
  const existing = loadLatest();
  const now = new Date().toISOString();

  const stockIds = ["samsung", "skHynix"];
  const newStocks = existing?.stocks ? { ...existing.stocks } : {};
  let anyUpdated = false;

  for (const stockId of stockIds) {
    const config = SYMBOLS[stockId];
    console.log(`[fetch-market-data] Fetching ${config.binanceSymbol}...`);

    try {
      // Fetch 24hr ticker and premiumIndex in parallel; bookTicker is optional
      const [ticker, premiumIndex, bookTicker] = await Promise.all([
        fetchFutures24hr(config.binanceSymbol),
        fetchPremiumIndex(config.binanceSymbol),
        fetchBookTicker(config.binanceSymbol).catch(() => null),
      ]);

      if (!ticker.symbol || ticker.symbol !== config.binanceSymbol) {
        throw new Error(`Symbol mismatch: ${ticker.symbol}`);
      }

      const baselineStock = baseline?.stocks?.[stockId];
      const mode = baselineStock?.referencePriceMode ?? "mark";
      const currentPrice = selectReferencePrice(ticker, premiumIndex, bookTicker, mode);

      if (!currentPrice) {
        throw new Error(`No valid price for ${config.binanceSymbol}`);
      }

      const bid = parsePositive(bookTicker?.bidPrice);
      const ask = parsePositive(bookTicker?.askPrice);
      const spreadPercent =
        bid && ask && bid <= ask ? ((ask - bid) / ask) * 100 : null;

      let estimateFields = {
        rawEstimatedPrice: 0,
        estimatedPrice: 0,
        changeAmount: 0,
        changeRate: 0,
        status: "no-baseline",
      };

      if (baselineStock && baselineStock.krxClose > 0 && baselineStock.binanceReferencePrice > 0) {
        const changeRate = currentPrice / baselineStock.binanceReferencePrice - 1;
        const rawEstimatedPrice = baselineStock.krxClose * (1 + changeRate);
        const estimatedPrice = roundToKrxTick(rawEstimatedPrice);

        estimateFields = {
          rawEstimatedPrice,
          estimatedPrice,
          changeAmount: estimatedPrice - baselineStock.krxClose,
          changeRate,
          status: "healthy",
        };
      }

      newStocks[stockId] = {
        displayName: config.displayName,
        koreanTicker: config.koreanTicker,
        binanceSymbol: config.binanceSymbol,
        krxClose: baselineStock?.krxClose ?? 0,
        baselineBinancePrice: baselineStock?.binanceReferencePrice ?? 0,
        currentBinancePrice: currentPrice,
        referencePriceMode: baselineStock?.referencePriceMode ?? "mark",
        bidPrice: bid,
        askPrice: ask,
        spreadPercent,
        confidenceScore: calculateConfidenceScore({
          ticker,
          premiumIndex,
          bookTicker,
          baselineStock,
        }),
        eventTime: premiumIndex.time
          ? new Date(premiumIndex.time).toISOString()
          : now,
        ...estimateFields,
      };

      anyUpdated = true;
      console.log(
        `[fetch-market-data] ${config.binanceSymbol}: ${currentPrice} (status: ${estimateFields.status})`
      );
    } catch (err) {
      console.error(`[fetch-market-data] Error for ${config.binanceSymbol}:`, err.message);
      // Keep existing data for this stock
    }
  }

  if (!anyUpdated) {
    if (existing) {
      console.warn(
        "[fetch-market-data] No stocks updated. Keeping existing latest.json unchanged."
      );
      process.exit(0);
    }
    console.error("[fetch-market-data] No stocks updated and no existing data. Aborting.");
    process.exit(1);
  }

  const output = {
    schemaVersion: 1,
    generatedAt: now,
    source: "github-actions",
    stocks: newStocks,
  };

  writeFileSync(join(DATA_DIR, "latest.json"), JSON.stringify(output, null, 2));
  console.log("[fetch-market-data] Written latest.json");
}

main().catch((err) => {
  console.error("[fetch-market-data] Fatal:", err);
  process.exit(1);
});
