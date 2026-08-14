/**
 * scripts/update-baseline.mjs
 *
 * Refreshes public/data/baseline.json with KRX anchor prices.
 *
 * Data source: Yahoo Finance v8 chart API only (no auth, no geo-block).
 *
 * Binance is deliberately NOT called here: GitHub-hosted runners are US-based
 * and Binance answers them with HTTP 451, which previously aborted every run
 * and froze the baseline for nine days. The matching futures anchor price is
 * derived in the browser (src/lib/binance/klines.ts) from anchorTimeUtc.
 *
 * Sessions:
 *   --session=open   09:20 KST run — records today's opening price
 *   --session=close  15:40 KST run — records today's opening AND closing price
 *
 * Exit codes:
 *   0  – updated, or skipped safely (weekend, too early, already current, holiday)
 *   1  – fatal error (network failure, validation failure); existing file kept
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");
const BASELINE_PATH = join(DATA_DIR, "baseline.json");

const YAHOO_USER_AGENT = "Mozilla/5.0 (compatible; stock-predict-bot/1.0)";
const REFERENCE_PRICE_MODE = "mark";

const SYMBOLS = {
  samsung: {
    displayName: "삼성전자",
    koreanTicker: "005930",
    yahooSymbol: "005930.KS",
  },
  skHynix: {
    displayName: "SK하이닉스",
    koreanTicker: "000660",
    yahooSymbol: "000660.KS",
  },
};

const STOCK_IDS = Object.keys(SYMBOLS);

// KRX regular session in KST. Open anchor = 09:00, close anchor = 15:30.
const KRX_OPEN_UTC_HOUR = 0; // 09:00 KST
const KRX_OPEN_UTC_MINUTE = 0;
const KRX_CLOSE_UTC_HOUR = 6; // 15:30 KST
const KRX_CLOSE_UTC_MINUTE = 30;

// Earliest KST time each session may run (Yahoo needs a few minutes to settle).
const OPEN_SESSION_READY = { hour: 9, minute: 15 };
const CLOSE_SESSION_READY = { hour: 15, minute: 31 };

// ─── 시간 유틸리티 ────────────────────────────────────────────────────────────

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

function weekdayKST() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date());
}

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

function isAtOrAfter({ hour, minute }) {
  const now = currentKSTTime();
  return now.hour > hour || (now.hour === hour && now.minute >= minute);
}

/** Anchor instant for a session, as an ISO UTC string. */
function anchorTimeUtc(kstDateStr, session) {
  const [year, month, day] = kstDateStr.split("-").map(Number);
  const [h, m] =
    session === "open"
      ? [KRX_OPEN_UTC_HOUR, KRX_OPEN_UTC_MINUTE]
      : [KRX_CLOSE_UTC_HOUR, KRX_CLOSE_UTC_MINUTE];
  return new Date(Date.UTC(year, month - 1, day, h, m, 0, 0)).toISOString();
}

// ─── API 호출 ─────────────────────────────────────────────────────────────────

/**
 * Yahoo Finance daily candles. Returns the most recent bar with its trading
 * date, opening price and closing price.
 */
/**
 * Retries a network call a few times before giving up.
 *
 * One hiccup at Yahoo used to cost the whole session: the script exits non-zero,
 * the old file is kept, and nothing tries again until the next scheduled run —
 * which for the close anchor means the day's closing prices are simply missing.
 * Three attempts with a widening gap turns a blip into a delay.
 */
async function withRetries(label, run, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const waitMs = attempt * 3000;
      console.warn(
        `[baseline] ${label} 시도 ${attempt}/${attempts} 실패: ${error.message} — ${waitMs}ms 후 재시도`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function fetchYahooDaily(yahooSymbol) {
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
  if (!result) throw new Error(`Yahoo Finance: no result for ${yahooSymbol}`);

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens = quote.open ?? [];
  const closes = quote.close ?? [];
  if (timestamps.length === 0) {
    throw new Error(`Yahoo Finance: 빈 데이터 for ${yahooSymbol}`);
  }

  const i = timestamps.length - 1;
  // KRX daily bars are stamped at the session open (00:00 UTC = 09:00 KST),
  // so the UTC date of the timestamp is the trading date.
  return {
    tradingDate: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
    open: opens[i],
    close: closes[i],
  };
}

// ─── 파일 I/O ─────────────────────────────────────────────────────────────────

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

/** Convert a legacy v1 baseline into the v2 close anchor so history is kept. */
function migrateV1(existing) {
  if (!existing || existing.schemaVersion === 2) return existing;
  const marketDate = existing.marketDate;
  const legacy = existing.stocks;
  if (!marketDate || !legacy) return null;

  const stocks = {};
  for (const id of STOCK_IDS) {
    const price = legacy[id]?.krxClose;
    if (!(price > 0)) return null;
    stocks[id] = { krxPrice: price };
  }
  return {
    schemaVersion: 2,
    timezone: "Asia/Seoul",
    updatedAt: existing.capturedAt ?? new Date().toISOString(),
    referencePriceMode: existing.stocks?.samsung?.referencePriceMode ?? REFERENCE_PRICE_MODE,
    close: {
      marketDate,
      anchorTimeUtc: anchorTimeUtc(marketDate, "close"),
      stocks,
    },
    open: null,
  };
}

/** Atomic write so a crash never leaves a truncated baseline behind. */
function writeBaseline(baseline) {
  const tmp = `${BASELINE_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(baseline, null, 2)}\n`);
  renameSync(tmp, BASELINE_PATH);
}

// ─── 검증 ─────────────────────────────────────────────────────────────────────

function assertSanePrice(displayName, label, price) {
  if (!(price > 0)) {
    throw new Error(`${displayName}: ${label} (${price}) > 0 조건 미충족`);
  }
  if (price < 1_000 || price > 10_000_000) {
    throw new Error(
      `${displayName}: ${label} ${price} 범위 이탈 (1,000 ~ 10,000,000)`
    );
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

function parseSession() {
  const arg = process.argv.find((a) => a.startsWith("--session="));
  const value = (arg ? arg.split("=")[1] : process.env.BASELINE_SESSION) || "close";
  if (value !== "open" && value !== "close") {
    throw new Error(`알 수 없는 session: ${value} (open 또는 close)`);
  }
  return value;
}

async function main() {
  const session = parseSession();
  console.log(`[update-baseline] 시작 (session=${session})...`);

  const weekday = weekdayKST();
  if (weekday === "Sat" || weekday === "Sun") {
    console.log(`[update-baseline] 주말 휴장 스킵 (${weekday} KST). 정상 종료.`);
    return;
  }

  const readyAt = session === "open" ? OPEN_SESSION_READY : CLOSE_SESSION_READY;
  if (!isAtOrAfter(readyAt)) {
    const { hour, minute } = currentKSTTime();
    console.log(
      `[update-baseline] ${session} 세션 시각 이전 스킵 ` +
        `(현재 ${hour}:${String(minute).padStart(2, "0")} KST, 기준 ` +
        `${readyAt.hour}:${String(readyAt.minute).padStart(2, "0")}). 정상 종료.`
    );
    return;
  }

  const targetDateKST = todayKST();
  console.log(`[update-baseline] 대상 거래일: ${targetDateKST}`);

  const existing = migrateV1(loadBaseline());
  if (existing?.[session]?.marketDate === targetDateKST) {
    console.log(
      `[update-baseline] ${session} 앵커가 이미 ${targetDateKST} 기준으로 최신. 스킵.`
    );
    return;
  }

  console.log("[update-baseline] Yahoo Finance에서 KRX 시가·종가 조회 중...");
  const results = await Promise.allSettled(
    STOCK_IDS.map((id) =>
      withRetries(`${SYMBOLS[id].displayName} 조회`, () =>
        fetchYahooDaily(SYMBOLS[id].yahooSymbol)
      )
    )
  );

  const collected = {};
  for (let i = 0; i < STOCK_IDS.length; i++) {
    const stockId = STOCK_IDS[i];
    const config = SYMBOLS[stockId];
    const result = results[i];

    if (result.status === "rejected") {
      throw new Error(
        `Yahoo Finance 조회 실패 for ${config.yahooSymbol}: ${result.reason.message}`
      );
    }

    const { tradingDate, open, close } = result.value;
    if (tradingDate !== targetDateKST) {
      console.log(
        `[update-baseline] Yahoo 최신 거래일 ${tradingDate} ≠ 오늘 ${targetDateKST}.` +
          ` 공휴일이거나 데이터 미확정. 스킵. 정상 종료.`
      );
      return;
    }
    collected[stockId] = { tradingDate, open, close };
  }

  const uniqueDates = [...new Set(STOCK_IDS.map((id) => collected[id].tradingDate))];
  if (uniqueDates.length > 1) {
    throw new Error(`종목 간 거래일 불일치: ${uniqueDates.join(", ")}`);
  }

  // The close run also refreshes the opening anchor: by then the day's bar is
  // final, so both anchors describe the same completed session.
  const sessionsToWrite = session === "close" ? ["open", "close"] : ["open"];

  const next = existing ?? {
    schemaVersion: 2,
    timezone: "Asia/Seoul",
    updatedAt: new Date().toISOString(),
    referencePriceMode: REFERENCE_PRICE_MODE,
    close: null,
    open: null,
  };
  next.schemaVersion = 2;
  next.timezone = "Asia/Seoul";
  next.referencePriceMode = next.referencePriceMode ?? REFERENCE_PRICE_MODE;

  for (const kind of sessionsToWrite) {
    const stocks = {};
    for (const stockId of STOCK_IDS) {
      const config = SYMBOLS[stockId];
      const price = kind === "open" ? collected[stockId].open : collected[stockId].close;
      assertSanePrice(config.displayName, kind === "open" ? "시가" : "종가", price);
      stocks[stockId] = { krxPrice: price };
      console.log(
        `[update-baseline] ${config.displayName} (${config.koreanTicker}) ` +
          `${kind === "open" ? "시가" : "종가"}: ${price.toLocaleString("ko-KR")}원`
      );
    }
    next[kind] = {
      marketDate: targetDateKST,
      anchorTimeUtc: anchorTimeUtc(targetDateKST, kind),
      stocks,
    };
  }

  next.updatedAt = new Date().toISOString();
  writeBaseline(next);

  console.log(
    `[update-baseline] baseline.json 갱신 완료 (${targetDateKST}, ${sessionsToWrite.join("+")})`
  );
}

main().catch((err) => {
  console.error("[update-baseline] Fatal:", err.message);
  process.exit(1);
});
