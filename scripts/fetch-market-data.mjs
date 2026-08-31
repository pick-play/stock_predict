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
  hyundai: { displayName: "현대차", koreanTicker: "005380", binanceSymbol: "HYUNDAIUSDT" },
  samsungEM: { displayName: "삼성전기", koreanTicker: "009150", binanceSymbol: "SAMSUNGEMUSDT" },
  lgElectronics: { displayName: "LG전자", koreanTicker: "066570", binanceSymbol: "LGELECTRONICSUSDT" },
  hanmi: { displayName: "한미반도체", koreanTicker: "042700", binanceSymbol: "HANMIUSDT" },
  naver: { displayName: "NAVER", koreanTicker: "035420", binanceSymbol: "NAVERUSDT" },
};

// USDT-M Futures REST base
const BINANCE_FUTURES_REST = "https://fapi.binance.com";

/**
 * Night-session limit, mirroring src/config/market.ts.
 *
 * Duplicated rather than imported: this script runs as plain Node with no
 * bundler, and a browser module would drag in import.meta.env. If the browser's
 * value changes, change it here too — a fallback that prices a stock past the
 * limit the site itself enforces would contradict the card it stands in for.
 */
const NIGHT_SESSION_LIMIT_RATE = 0.08;

/**
 * The mark price at one exact minute, used as the anchor.
 *
 * The v2 baseline stores only the KRX side of the anchor; the futures side is
 * whatever the contract printed at that same instant, which is what makes the
 * ratio a like-for-like overnight move. Same endpoint and same rule the browser
 * uses (src/lib/binance/klinesClient.ts), so the two cannot drift apart.
 */
async function fetchMarkPriceAtTime(symbol, openTimeMs) {
  const url =
    `${BINANCE_FUTURES_REST}/fapi/v1/markPriceKlines` +
    `?symbol=${encodeURIComponent(symbol)}&interval=1m` +
    `&startTime=${openTimeMs}&limit=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const kline = rows[0];
    if (!Array.isArray(kline) || kline.length < 2) return null;
    // Binance clamps an unavailable startTime to the nearest kline it has, so
    // the returned open time has to be the one that was asked for.
    if (Number(kline[0]) !== openTimeMs) return null;
    return parsePositive(kline[1]);
  } catch {
    return null;
  }
}

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

// src/lib/roundToKrxTick.ts의 사본 — 입력 검증까지 포함해서 같아야 한다.
// NaN·음수를 여기서 던지지 않으면 그대로 latest.json에 직렬화된다.
function getKrxTickSize(price) {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite non-negative number");
  }
  if (price < 1_000) return 1;
  if (price < 5_000) return 5;
  if (price < 10_000) return 10;
  if (price < 50_000) return 50;
  if (price < 100_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

function roundToKrxTick(price) {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite non-negative number");
  }
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

/**
 * The KRX side of the anchor, from the v2 baseline.
 *
 * Always the close (owner decision, 2026-08-18) — the `open` block is still
 * written but nothing reads it. This script used to look for `stocks[id]
 * .krxClose` and `.binanceReferencePrice`, fields the v1 file had and v2 does
 * not, so every stock silently came out `no-baseline`: the collector would have
 * written a latest.json with no estimates in it at all.
 */
function resolveAnchor(baseline) {
  const close = baseline?.close;
  if (!close?.stocks) return null;
  const anchorTimeMs = Date.parse(close.anchorTimeUtc);
  if (!Number.isFinite(anchorTimeMs)) return null;
  return {
    marketDate: close.marketDate,
    anchorTimeMs,
    krxPrice: close.stocks,
  };
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

/** Wall-clock weekday (and minutes past midnight) in the given time zone. */
function zoneParts(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // h23 still yields "24" for midnight in some engines.
  const hour = get("hour") === "24" ? 0 : parseInt(get("hour"), 10);
  return {
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
    minutes: hour * 60 + parseInt(get("minute"), 10),
  };
}

/** 16:00 in New York — the closing bell, in minutes past midnight. */
const US_CLOSE_MINUTES = 16 * 60;

/**
 * 주말 판정 — src/lib/koreaMarket.ts isWeekend()가 원본이다(§28: 주말은 미국
 * 마감부터). 한국 토요일 00시는 뉴욕이 아직 금요일 오후장을 하는 시간이라,
 * KST 요일만 보면 실제 해외 거래량 위에서 움직이는 시세에 주말 감점을 준다.
 * 경계는 뉴욕 시계로 계산한다 — 시차가 서머타임에 9시간, 아닐 때 10시간이라
 * KST 고정 시각으로 박으면 1년의 절반이 틀린다. 이 스크립트는 plain Node라
 * TS를 import할 수 없어 여기 복제한다 — 원본이 바뀌면 함께 고친다.
 */
function isWeekendInKorea(date = new Date()) {
  const seoulDay = zoneParts("Asia/Seoul", date).dayOfWeek;
  // 서울 일요일은 뉴욕의 토요일 또는 이른 일요일: 어느 쪽이든 휴장이다.
  if (seoulDay === 0) return true;
  if (seoulDay !== 6) return false;
  const eastern = zoneParts("America/New_York", date);
  // 서울 토요일은 뉴욕 저녁까지는 아직 금요일이다.
  if (eastern.dayOfWeek === 5) return eastern.minutes >= US_CLOSE_MINUTES;
  return true;
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
  const anchor = resolveAnchor(baseline);
  const existing = loadLatest();
  const now = new Date().toISOString();

  // Derived from SYMBOLS so adding a listing in one place is enough.
  const stockIds = Object.keys(SYMBOLS);

  if (!anchor) {
    console.warn(
      "[fetch-market-data] baseline.json에 close 앵커가 없습니다. 예상가 없이 시세만 기록합니다."
    );
  } else {
    console.log(
      `[fetch-market-data] 앵커: ${anchor.marketDate} 종가 ` +
        `(${new Date(anchor.anchorTimeMs).toISOString()})`
    );
  }
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

      const anchorKrxPrice = anchor?.krxPrice?.[stockId]?.krxPrice;
      const anchorFuturesPrice = anchor
        ? await fetchMarkPriceAtTime(config.binanceSymbol, anchor.anchorTimeMs)
        : null;
      const mode = baseline?.referencePriceMode ?? "mark";
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
        limited: false,
        status: "no-baseline",
      };

      if (anchorKrxPrice > 0 && anchorFuturesPrice > 0) {
        const rawChangeRate = currentPrice / anchorFuturesPrice - 1;
        /*
         * Clamped on the RATE, not on the price.
         *
         * Same rule as src/lib/calculateEstimate.ts: derive the shown price
         * from the clamped rate so the two agree. Clamping a price that was
         * built from an unclamped rate leaves a card whose percentage and
         * won figure describe different calculations. rawEstimatedPrice keeps
         * the unclamped number for anyone who wants to see how far out it was.
         *
         * The epsilon is not decoration (calculateEstimate.ts와 같은 이유):
         * 108/100 - 1 is 0.08000000000000007 in binary floating point, so a
         * bare `>` reports a price sitting exactly on the limit as having
         * exceeded it. The boundary itself is a legal price.
         */
        const limited =
          Math.abs(rawChangeRate) > NIGHT_SESSION_LIMIT_RATE + Number.EPSILON * 8;
        const changeRate = limited
          ? Math.sign(rawChangeRate) * NIGHT_SESSION_LIMIT_RATE
          : rawChangeRate;
        const rawEstimatedPrice = anchorKrxPrice * (1 + rawChangeRate);
        const estimatedPrice = roundToKrxTick(anchorKrxPrice * (1 + changeRate));

        estimateFields = {
          rawEstimatedPrice,
          estimatedPrice,
          changeAmount: estimatedPrice - anchorKrxPrice,
          changeRate,
          // 잘렸다는 사실을 폴백 JSON에도 남긴다 — 브라우저 스키마가 이미
          // 받는 필드다(validation.ts의 limited).
          limited,
          status: "healthy",
        };
      }

      newStocks[stockId] = {
        displayName: config.displayName,
        koreanTicker: config.koreanTicker,
        binanceSymbol: config.binanceSymbol,
        krxClose: anchorKrxPrice > 0 ? anchorKrxPrice : 0,
        baselineBinancePrice: anchorFuturesPrice > 0 ? anchorFuturesPrice : 0,
        currentBinancePrice: currentPrice,
        referencePriceMode: mode,
        bidPrice: bid,
        askPrice: ask,
        spreadPercent,
        confidenceScore: calculateConfidenceScore({
          ticker,
          premiumIndex,
          bookTicker,
          baselineStock: {
            krxClose: anchorKrxPrice ?? 0,
            binanceReferencePrice: anchorFuturesPrice ?? 0,
          },
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
