/**
 * Fetches market data from Binance and updates public/data/latest.json
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

const BINANCE_REST = "https://api.binance.com";

async function fetchTicker(symbol) {
  const url = `${BINANCE_REST}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  return res.json();
}

function parsePositive(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function selectReferencePrice(ticker, mode = "mark") {
  const last = parsePositive(ticker.lastPrice);
  const bid = parsePositive(ticker.bidPrice);
  const ask = parsePositive(ticker.askPrice);

  if (mode === "mid" && bid && ask && bid <= ask) return (bid + ask) / 2;
  if (mode === "last" && last) return last;

  // Default: last (TradFi spot has no markPrice)
  if (last) return last;
  if (bid && ask) return (bid + ask) / 2;
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

async function main() {
  console.log("[fetch-market-data] Starting...");

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
      const ticker = await fetchTicker(config.binanceSymbol);

      if (!ticker.symbol || ticker.symbol !== config.binanceSymbol) {
        throw new Error(`Symbol mismatch: ${ticker.symbol}`);
      }

      const currentPrice = selectReferencePrice(ticker, "last");
      if (!currentPrice) {
        throw new Error(`No valid price for ${config.binanceSymbol}`);
      }

      const baselineStock = baseline?.stocks?.[stockId];
      const bid = parsePositive(ticker.bidPrice);
      const ask = parsePositive(ticker.askPrice);
      const spreadPercent = bid && ask && bid <= ask ? ((ask - bid) / ask) * 100 : null;

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
        referencePriceMode: baselineStock?.referencePriceMode ?? "last",
        bidPrice: bid,
        askPrice: ask,
        spreadPercent,
        confidenceScore: estimateFields.status === "healthy" ? 80 : 20,
        eventTime: ticker.closeTime
          ? new Date(ticker.closeTime).toISOString()
          : now,
        ...estimateFields,
      };

      anyUpdated = true;
      console.log(`[fetch-market-data] ${config.binanceSymbol}: ${currentPrice} (status: ${estimateFields.status})`);
    } catch (err) {
      console.error(`[fetch-market-data] Error for ${config.binanceSymbol}:`, err.message);
      // Keep existing data for this stock
    }
  }

  if (!anyUpdated) {
    console.error("[fetch-market-data] No stocks updated. Aborting.");
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
