/**
 * Validates public/data/latest.json and public/data/baseline.json
 * Exits non-zero if validation fails.
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(dirname(__dirname), "public", "data");

let errors = 0;

function fail(msg) {
  console.error(`[validate] FAIL: ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`[validate] OK: ${msg}`);
}

/** UTC 시각이 속하는 한국 달력 날짜 (YYYY-MM-DD). */
function kstDateOf(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    date
  );
}

/*
 * src/config/symbols.ts의 MARKET_SYMBOLS를 비춘 사본. 이 스크립트는 plain
 * Node라 TS를 import할 수 없어 fetch-market-data.mjs와 같은 방식으로 복제한다
 * — 원본에서 종목을 더하거나 바꾸면 여기도 함께 고친다.
 */
const EXPECTED_BINANCE_SYMBOLS = {
  samsung: "SAMSUNGUSDT",
  skHynix: "SKHYNIXUSDT",
  hyundai: "HYUNDAIUSDT",
  samsungEM: "SAMSUNGEMUSDT",
  lgElectronics: "LGELECTRONICSUSDT",
  hanmi: "HANMIUSDT",
  naver: "NAVERUSDT",
};

function validateLatest() {
  const path = join(DATA_DIR, "latest.json");
  if (!existsSync(path)) {
    fail("latest.json not found");
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    fail(`latest.json is not valid JSON: ${e.message}`);
    return;
  }

  if (data.schemaVersion !== 1) fail(`schemaVersion should be 1, got ${data.schemaVersion}`);
  if (!data.generatedAt) fail("generatedAt missing");
  if (!data.source) fail("source missing");
  if (!data.stocks) { fail("stocks missing"); return; }

  const futureBoundary = Date.now() + 60_000;
  if (new Date(data.generatedAt).getTime() > futureBoundary) {
    fail(`generatedAt is in the future: ${data.generatedAt}`);
  }

  for (const [id, stock] of Object.entries(data.stocks)) {
    if (!stock.binanceSymbol) fail(`${id}: binanceSymbol missing`);
    if (!stock.eventTime) fail(`${id}: eventTime missing`);

    // 종목 심볼이 요청 심볼과 일치해야 함(§17): id에 다른 종목의 심볼이 붙어
    // 있으면 수집기가 엉뚱한 계약의 가격을 그 카드에 실은 것이다.
    const expectedSymbol = EXPECTED_BINANCE_SYMBOLS[id];
    if (!expectedSymbol) {
      fail(`${id}: 설정에 없는 종목 id (src/config/symbols.ts 참조)`);
    } else if (stock.binanceSymbol && stock.binanceSymbol !== expectedSymbol) {
      fail(
        `${id}: binanceSymbol ${stock.binanceSymbol} ≠ 설정값 ${expectedSymbol}`
      );
    }

    // 미래로 찍힌 eventTime은 시계가 고장난 데이터다 — 나이 검사가 영원히
    // "신선"으로 통과시키므로 여기서 거부한다.
    if (stock.eventTime) {
      const eventMs = new Date(stock.eventTime).getTime();
      if (isNaN(eventMs)) {
        fail(`${id}: eventTime invalid: ${stock.eventTime}`);
      } else if (eventMs > futureBoundary) {
        fail(`${id}: eventTime is in the future: ${stock.eventTime}`);
      }
    }

    if (stock.status === "healthy") {
      if (!(stock.currentBinancePrice > 0)) fail(`${id}: currentBinancePrice must be > 0`);
      if (!(stock.krxClose > 0)) fail(`${id}: krxClose must be > 0`);
      if (!(stock.baselineBinancePrice > 0)) fail(`${id}: baselineBinancePrice must be > 0`);
      if (!(stock.estimatedPrice > 0)) fail(`${id}: estimatedPrice must be > 0`);

      if (stock.bidPrice !== null && stock.askPrice !== null) {
        if (stock.bidPrice > stock.askPrice) {
          fail(`${id}: bid > ask (${stock.bidPrice} > ${stock.askPrice})`);
        }
      }

      const ageMins = (Date.now() - new Date(stock.eventTime).getTime()) / 60_000;
      if (ageMins > 30) {
        console.warn(`[validate] WARN: ${id} data is ${ageMins.toFixed(1)} minutes old`);
      }
    }
  }

  ok("latest.json validated");
}

function validateBaseline() {
  const path = join(DATA_DIR, "baseline.json");
  if (!existsSync(path)) {
    fail("baseline.json not found");
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    fail(`baseline.json is not valid JSON: ${e.message}`);
    return;
  }

  if (data.schemaVersion !== 2) {
    fail(`baseline.json schemaVersion must be 2, got ${data.schemaVersion}`);
    return;
  }
  if (!data.updatedAt) fail("updatedAt missing");

  // At least one anchor must be usable, otherwise the app cannot estimate.
  if (!data.open && !data.close) {
    fail("baseline.json has neither an open nor a close anchor");
    return;
  }

  for (const kind of ["open", "close"]) {
    const anchor = data[kind];
    if (!anchor) {
      console.log(`[validate] INFO: ${kind} anchor not yet captured`);
      continue;
    }

    if (!anchor.marketDate) fail(`${kind}: marketDate missing`);
    const marketDate = new Date(`${anchor.marketDate}T00:00:00+09:00`);
    if (isNaN(marketDate.getTime())) {
      fail(`${kind}: marketDate invalid: ${anchor.marketDate}`);
    } else if (anchor.marketDate > kstDateOf(new Date())) {
      // 기준일이 미래가 아님(§7). 예전의 +24시간 여유는 KST 자정을 넘긴 지연
      // 실행을 봐주려던 것인데, 애초에 한국 달력으로 비교하면 여유가 필요
      // 없다 — ISO 날짜 문자열은 사전순 비교가 곧 시간순이다.
      fail(`${kind}: marketDate is in the future: ${anchor.marketDate}`);
    }

    const anchorTime = new Date(anchor.anchorTimeUtc);
    if (!anchor.anchorTimeUtc || isNaN(anchorTime.getTime())) {
      fail(`${kind}: anchorTimeUtc invalid: ${anchor.anchorTimeUtc}`);
    } else if (anchor.marketDate && kstDateOf(anchorTime) !== anchor.marketDate) {
      // 앵커 시각이 marketDate와 다른 날에 찍혀 있으면 라벨과 데이터가 서로
      // 다른 날을 말하는 것이다 — 어제 값을 오늘 날짜로 포장하는 부류의
      // 버그를 커밋 전에 여기서 잡는다(§2.2).
      fail(
        `${kind}: anchorTimeUtc ${anchor.anchorTimeUtc}는 KST ` +
          `${kstDateOf(anchorTime)}에 속함 — marketDate ${anchor.marketDate}와 불일치`
      );
    }

    if (!anchor.stocks) {
      fail(`${kind}: stocks missing`);
      continue;
    }
    // Whatever the collector managed to price is checked; a stock it had to
    // skip is not an error, because demanding a fixed roster here would fail
    // the whole file — and block the commit — over one unsettled ticker.
    const entries = Object.entries(anchor.stocks);
    if (entries.length === 0) {
      fail(`${kind}: no stock carries a price`);
      continue;
    }
    for (const [id, stock] of entries) {
      if (!(stock?.krxPrice > 0)) fail(`${kind}.${id}: krxPrice must be > 0`);
    }
  }

  // Every stock in an anchor shares its marketDate by construction; the two
  // anchors may legitimately differ (intraday open vs previous close).
  ok("baseline.json validated");
}

validateLatest();
validateBaseline();

if (errors > 0) {
  console.error(`[validate] ${errors} error(s) found. Aborting.`);
  process.exit(1);
} else {
  console.log("[validate] All checks passed.");
}
