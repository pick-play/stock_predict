/**
 * scripts/update-baseline.mjs
 *
 * Refreshes public/data/baseline.json after each KRX trading session.
 *
 * Data sources:
 *   1차 (KRX 종가):    Yahoo Finance v8 chart API (인증 불필요)
 *   1차 (바이낸스 기준가): fapi.binance.com markPriceKlines (KRX 마감 시점 = 06:30 UTC)
 *
 * Exit codes:
 *   0  – 정상 종료 (baseline 갱신 완료 OR 스킵: 주말/장 마감 전/이미 최신/공휴일)
 *   1  – 치명적 오류 (네트워크 실패, 검증 실패 등)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");

const YAHOO_USER_AGENT = "Mozilla/5.0 (compatible; stock-predict-bot/1.0)";
const BINANCE_FUTURES_REST = "https://fapi.binance.com";

const SYMBOLS = {
  samsung: {
    displayName: "삼성전자",
    koreanTicker: "005930",
    yahooSymbol: "005930.KS",
    binanceSymbol: "SAMSUNGUSDT",
    referencePriceMode: "mark",
  },
  skHynix: {
    displayName: "SK하이닉스",
    koreanTicker: "000660",
    yahooSymbol: "000660.KS",
    binanceSymbol: "SKHYNIXUSDT",
    referencePriceMode: "mark",
  },
};

// ─── 시간 유틸리티 ────────────────────────────────────────────────────────────

/** 현재 KST 날짜를 "YYYY-MM-DD" 형식으로 반환 */
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** 현재 KST 요일(약자)을 반환 (예: "Mon", "Sat") */
function weekdayKST() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date());
}

/** 현재 KST 시각(시, 분)을 반환 */
function currentKSTTime() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return { hour, minute };
}

/**
 * KRX 정규장 마감(15:30 KST) 이후인지 확인.
 * Yahoo Finance 데이터 반영 여유를 위해 15:31 이후를 기준으로 한다.
 */
function isAfterKRXClose() {
  const { hour, minute } = currentKSTTime();
  return hour > 15 || (hour === 15 && minute >= 31);
}

/**
 * KST 날짜 문자열(YYYY-MM-DD)로부터 KRX 마감 시각의 UTC 타임스탬프(ms)를 계산.
 * KRX 마감 = 15:30 KST = 06:30 UTC
 */
function krxCloseUTCMs(kstDateStr) {
  const [year, month, day] = kstDateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 6, 30, 0, 0);
}

// ─── API 호출 ─────────────────────────────────────────────────────────────────

/**
 * Yahoo Finance v8 차트 API에서 일봉 데이터를 조회.
 * 반환값: { timestamp: number[], close: number[], regularMarketTime: number }
 */
async function fetchYahooChart(yahooSymbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${yahooSymbol}`);
  }
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo Finance: no result for ${yahooSymbol}`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  if (timestamps.length === 0 || closes.length === 0) {
    throw new Error(`Yahoo Finance: 빈 데이터 for ${yahooSymbol}`);
  }
  return { timestamps, closes };
}

/**
 * Binance USDT-M Futures markPriceKlines에서 KRX 마감 시점의 마크가격을 조회.
 * KRX 마감(06:30 UTC) 1분봉의 시가(open)를 사용 — 마감 시각의 마크가격에 가장 가까운 값.
 */
async function fetchBinanceMarkAtClose(binanceSymbol, kstDateStr) {
  const startMs = krxCloseUTCMs(kstDateStr);
  const url =
    `${BINANCE_FUTURES_REST}/fapi/v1/markPriceKlines` +
    `?symbol=${encodeURIComponent(binanceSymbol)}&interval=1m&startTime=${startMs}&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Binance markPriceKlines HTTP ${res.status} for ${binanceSymbol}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Binance markPriceKlines: 빈 응답 for ${binanceSymbol} at ${kstDateStr}`
    );
  }
  // Klines 형식: [openTime, open, high, low, close, ...]
  // close[4] = 06:30 UTC 1분봉 종가 = 15:30:59 KST 마크가격
  // open[1]보다 close[4]가 안정적 (open 스파이크 방지)
  const closePrice = parseFloat(data[0][4]);
  if (!Number.isFinite(closePrice) || closePrice <= 0) {
    throw new Error(
      `Binance markPriceKlines: 유효하지 않은 종가 for ${binanceSymbol}: ${data[0][4]}`
    );
  }
  return closePrice;
}

// ─── 파일 I/O ─────────────────────────────────────────────────────────────────

function loadBaseline() {
  const path = join(DATA_DIR, "baseline.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[update-baseline] 시작...");

  // ── 1단계: 주말 확인 ──────────────────────────────────────────────────────
  const weekday = weekdayKST();
  if (weekday === "Sat" || weekday === "Sun") {
    console.log(`[update-baseline] 주말 휴장 스킵 (${weekday} KST). 정상 종료.`);
    process.exit(0);
  }

  // ── 2단계: 장 마감 확인 ───────────────────────────────────────────────────
  if (!isAfterKRXClose()) {
    const { hour, minute } = currentKSTTime();
    console.log(
      `[update-baseline] 장 마감 전 스킵 (현재 ${hour}:${String(minute).padStart(2, "0")} KST, 기준 15:31). 정상 종료.`
    );
    process.exit(0);
  }

  const targetDateKST = todayKST();
  console.log(`[update-baseline] 대상 거래일: ${targetDateKST}`);

  // ── 3단계: 이미 최신 baseline인지 확인 ──────────────────────────────────
  const existing = loadBaseline();
  if (existing?.marketDate === targetDateKST) {
    console.log(
      `[update-baseline] baseline.json이 이미 ${targetDateKST} 기준으로 최신 상태. 스킵.`
    );
    process.exit(0);
  }

  // ── 4단계: Yahoo Finance에서 KRX 종가 조회 (1차 데이터 소스) ────────────
  const stockIds = Object.keys(SYMBOLS);
  const stockData = {};

  console.log("[update-baseline] Yahoo Finance에서 KRX 종가 조회 중...");
  const yahooResults = await Promise.allSettled(
    stockIds.map((id) => fetchYahooChart(SYMBOLS[id].yahooSymbol))
  );

  for (let i = 0; i < stockIds.length; i++) {
    const stockId = stockIds[i];
    const config = SYMBOLS[stockId];
    const result = yahooResults[i];

    if (result.status === "rejected") {
      throw new Error(
        `Yahoo Finance 조회 실패 for ${config.yahooSymbol}: ${result.reason.message}`
      );
    }

    const { timestamps, closes } = result.value;
    const lastTs = timestamps[timestamps.length - 1];
    const lastClose = closes[closes.length - 1];

    // Yahoo 타임스탬프는 UTC 자정(초)이며, 이것이 해당 거래일의 날짜를 나타냄
    const tradingDate = new Date(lastTs * 1000).toISOString().slice(0, 10);

    if (tradingDate !== targetDateKST) {
      // 오늘 거래 없음 → 공휴일이거나 데이터 미반영
      console.log(
        `[update-baseline] Yahoo Finance 최신 데이터: ${tradingDate} ≠ 오늘 ${targetDateKST}.` +
        ` 공휴일이거나 데이터 미확정. 스킵. 정상 종료.`
      );
      process.exit(0);
    }

    if (!(lastClose > 0)) {
      throw new Error(
        `Yahoo Finance: 유효하지 않은 종가 ${lastClose} for ${config.yahooSymbol}`
      );
    }

    console.log(
      `[update-baseline] ${config.displayName} (${config.koreanTicker}): KRX 종가 ${lastClose.toLocaleString("ko-KR")}원`
    );
    stockData[stockId] = { krxClose: lastClose, tradingDate };
  }

  // 두 종목의 거래일 일치 검증
  const uniqueDates = [...new Set(stockIds.map((id) => stockData[id].tradingDate))];
  if (uniqueDates.length > 1) {
    throw new Error(`종목 간 거래일 불일치: ${uniqueDates.join(", ")}`);
  }

  // ── 5단계: Binance markPriceKlines에서 KRX 마감 기준가 조회 ─────────────
  console.log("[update-baseline] Binance markPriceKlines에서 기준가 조회 중...");
  const binanceResults = await Promise.allSettled(
    stockIds.map((id) =>
      fetchBinanceMarkAtClose(SYMBOLS[id].binanceSymbol, targetDateKST)
    )
  );

  for (let i = 0; i < stockIds.length; i++) {
    const stockId = stockIds[i];
    const config = SYMBOLS[stockId];
    const result = binanceResults[i];

    if (result.status === "rejected") {
      throw new Error(
        `Binance markPriceKlines 조회 실패 for ${config.binanceSymbol}: ${result.reason.message}`
      );
    }

    const markPrice = result.value;
    console.log(
      `[update-baseline] ${config.displayName}: 바이낸스 마감 기준가 ${markPrice}`
    );
    stockData[stockId].binanceReferencePrice = markPrice;
  }

  // ── 6단계: 검증 및 baseline.json 작성 ────────────────────────────────────
  for (const [stockId, data] of Object.entries(stockData)) {
    const config = SYMBOLS[stockId];

    if (!(data.krxClose > 0)) {
      throw new Error(`${config.displayName}: krxClose (${data.krxClose}) > 0 조건 미충족`);
    }
    if (!(data.binanceReferencePrice > 0)) {
      throw new Error(
        `${config.displayName}: binanceReferencePrice (${data.binanceReferencePrice}) > 0 조건 미충족`
      );
    }
    // 기준일이 미래가 아님 검증
    const dateMs = new Date(targetDateKST + "T00:00:00+09:00").getTime();
    if (dateMs > Date.now() + 24 * 60 * 60 * 1000) {
      throw new Error(`기준일 ${targetDateKST}이 미래 날짜`);
    }
    // 가격 합리성 검사 (느슨한 범위)
    if (data.krxClose < 1_000 || data.krxClose > 10_000_000) {
      throw new Error(
        `${config.displayName}: krxClose ${data.krxClose} 범위 이탈 (1,000 ~ 10,000,000)`
      );
    }
  }

  const capturedAt = new Date().toISOString();
  const baseline = {
    marketDate: targetDateKST,
    capturedAt,
    timezone: "Asia/Seoul",
    stocks: {
      samsung: {
        krxClose: stockData.samsung.krxClose,
        binanceReferencePrice: stockData.samsung.binanceReferencePrice,
        referencePriceMode: SYMBOLS.samsung.referencePriceMode,
      },
      skHynix: {
        krxClose: stockData.skHynix.krxClose,
        binanceReferencePrice: stockData.skHynix.binanceReferencePrice,
        referencePriceMode: SYMBOLS.skHynix.referencePriceMode,
      },
    },
  };

  writeFileSync(join(DATA_DIR, "baseline.json"), JSON.stringify(baseline, null, 2));

  console.log(
    `[update-baseline] baseline.json 갱신 완료 (${targetDateKST})\n` +
    `  삼성전자:  ${stockData.samsung.krxClose.toLocaleString("ko-KR")}원` +
    ` / 바이낸스 ${stockData.samsung.binanceReferencePrice}\n` +
    `  SK하이닉스: ${stockData.skHynix.krxClose.toLocaleString("ko-KR")}원` +
    ` / 바이낸스 ${stockData.skHynix.binanceReferencePrice}`
  );
}

main().catch((err) => {
  console.error("[update-baseline] Fatal:", err.message);
  process.exit(1);
});
