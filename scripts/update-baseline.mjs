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
 * derived in the browser (src/lib/binance/klinesClient.ts) from anchorTimeUtc.
 *
 * Sessions:
 *   --session=close  기본이자 유일한 예약 세션(15:40 KST + 매시 캐치업 슬롯).
 *                    목표 거래일의 시가와 종가를 함께 기록한다.
 *   --session=open   수동 전용. 09:20 정기 실행은 제거됐다(§28) — close 실행이
 *                    같은 일봉에서 시가를 함께 확정하므로 경로만 남겨 두었다.
 *
 * Exit codes:
 *   0  – updated, or skipped safely (이미 최신, 공휴일 등 날짜 불일치)
 *   1  – fatal error (전 종목 조회 실패, 검증 실패 등); existing file kept
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
  hyundai: {
    displayName: "현대차",
    koreanTicker: "005380",
    yahooSymbol: "005380.KS",
  },
  samsungEM: {
    displayName: "삼성전기",
    koreanTicker: "009150",
    yahooSymbol: "009150.KS",
  },
  lgElectronics: {
    displayName: "LG전자",
    koreanTicker: "066570",
    yahooSymbol: "066570.KS",
  },
  hanmi: {
    displayName: "한미반도체",
    koreanTicker: "042700",
    yahooSymbol: "042700.KS",
  },
  naver: {
    displayName: "NAVER",
    koreanTicker: "035420",
    yahooSymbol: "035420.KS",
  },
};

const STOCK_IDS = Object.keys(SYMBOLS);

// KRX regular session in KST. Open anchor = 09:00, close anchor = 15:30.
const KRX_OPEN_UTC_HOUR = 0; // 09:00 KST
const KRX_OPEN_UTC_MINUTE = 0;
const KRX_CLOSE_UTC_HOUR = 6; // 15:30 KST
const KRX_CLOSE_UTC_MINUTE = 30;

/*
 * The futures side of the close anchor is sampled three minutes AFTER the
 * close, not at it.
 *
 * The close itself never moves — 15:30, printed by the closing auction — but
 * the Binance contract does not know that number the instant it exists.
 * Measured over 2026-08-21/24/25, both majors show a consistent one-direction
 * jump in the 06:31-06:32 UTC candles as the contract absorbs the settled
 * close (0.4% on SK하이닉스 on the 25th), and are stable from 06:33. Anchoring
 * at 06:30:00 exactly meant that settlement jump was carried all night as a
 * phantom overnight move: the card said -0.4% at 15:35 when nothing had
 * happened yet.
 *
 * Three minutes covers the observed lag (owner saw the close print up to two
 * minutes late) without absorbing much genuine post-close drift. This offset
 * applies to the SAMPLING instant only — marketDate, display labels and the
 * meta-close validation all stay on the true 15:30 close.
 */
const CLOSE_ANCHOR_SETTLE_MINUTES = 3;

/*
 * Earliest KST time each session may target TODAY's bar.
 *
 * The close threshold is the anchor sampling minute itself (15:30 + settle,
 * see CLOSE_ANCHOR_SETTLE_MINUTES): writing an anchorTimeUtc that has not
 * happened yet would send the browser after a futures kline that does not
 * exist. Before this instant a run targets the previous weekday instead —
 * see lastTradingDayKST.
 */
const OPEN_SESSION_READY = { hour: 9, minute: 15 };
const CLOSE_SESSION_READY = {
  hour: 15,
  minute: KRX_CLOSE_UTC_MINUTE + CLOSE_ANCHOR_SETTLE_MINUTES, // 15:33
};

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

/**
 * The most recent weekday, as a KST date string.
 *
 * The run used to hard-skip weekends, which assumed runs happen when they are
 * scheduled. On 2026-08-28 GitHub's scheduler delivered all three of Friday's
 * slots nine to twelve hours late — after midnight KST — and the weekend guard
 * threw every one of them away, so Friday's close was never recorded and the
 * weekend's cards measured from Thursday.
 *
 * So the script now decides by DATA, not by arrival time: whenever it runs, it
 * converges on the latest weekday's settled bar. A weekend run targets Friday,
 * a delayed run targets the day it was meant for, and a run whose work is
 * already done exits in the "이미 최신" branch below.
 *
 * "Today" only counts once its bar can actually exist. 평일이라도 세션 준비
 * 시각(종가는 15:33 KST — 앵커 샘플링 분) 전이면 하루 물러선다. 그렇지 않으면
 * 15:40Z 캐치업 슬롯(= 화~금 00:40 KST)이 아직 열리지도 않은 "오늘"을 목표로
 * 삼고, 준비 게이트가 그걸 버려서 월~목 밤의 캐치업이 영구 no-op였다 — 물러선
 * 뒤에야 그 슬롯이 어제의 종가를 메울 수 있다.
 */
function lastTradingDayKST(session) {
  const [y, m, d] = todayKST().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay() of a bare calendar date is that date's weekday.
  const isWeekday = date.getUTCDay() >= 1 && date.getUTCDay() <= 5;
  const ready = session === "open" ? OPEN_SESSION_READY : CLOSE_SESSION_READY;
  if (isWeekday && !isAtOrAfter(ready)) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function currentKSTTime() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  // h23 still yields "24" for midnight in some engines — same guard as
  // src/lib/koreaMarket.ts. 자정의 캐치업 슬롯이 24:40으로 읽히면 어떤 준비
  // 시각보다도 뒤가 되어 "오늘"을 목표로 오판한다.
  const rawHour = parts.find((p) => p.type === "hour").value;
  const hour = rawHour === "24" ? 0 : parseInt(rawHour, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return { hour, minute };
}

function isAtOrAfter({ hour, minute }) {
  const now = currentKSTTime();
  return now.hour > hour || (now.hour === hour && now.minute >= minute);
}

/**
 * Anchor instant for a session, as an ISO UTC string.
 *
 * For the close this is the settled sampling instant (15:33 KST), which is what
 * the browser hands to markPriceKlines — see CLOSE_ANCHOR_SETTLE_MINUTES. The
 * exchange-time helpers below stay on the true 15:30.
 */
function anchorTimeUtc(kstDateStr, session) {
  const [year, month, day] = kstDateStr.split("-").map(Number);
  const [h, m] =
    session === "open"
      ? [KRX_OPEN_UTC_HOUR, KRX_OPEN_UTC_MINUTE]
      : [KRX_CLOSE_UTC_HOUR, KRX_CLOSE_UTC_MINUTE + CLOSE_ANCHOR_SETTLE_MINUTES];
  return new Date(Date.UTC(year, month - 1, day, h, m, 0, 0)).toISOString();
}

/** The true close instant (15:30 KST), for checks about the close itself. */
function closeInstantUtcMs(kstDateStr) {
  const [year, month, day] = kstDateStr.split("-").map(Number);
  return Date.UTC(
    year,
    month - 1,
    day,
    KRX_CLOSE_UTC_HOUR,
    KRX_CLOSE_UTC_MINUTE,
    0,
    0
  );
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
  const tradingDate = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);

  /*
   * Yahoo sometimes serves the newest daily bar with a null close even after
   * the session has settled — every KRX symbol answered that way on the evening
   * of 2026-08-22, hours after Friday's 15:30 close. Left alone that reads as
   * "미확정" and the stock is skipped, which is how a manual re-run of a failed
   * collection would quietly return nothing.
   *
   * meta carries the settled figure with its own timestamp, so it is usable
   * only under proof: same trading date, and stamped at or after the 15:30 KST
   * close. A meta price from a live session is a mid-session quote, not a
   * close, and must never be written as one.
   */
  let close = closes[i];
  if (close == null) {
    const metaPrice = result.meta?.regularMarketPrice;
    const metaTimeMs = (result.meta?.regularMarketTime ?? 0) * 1000;
    const closeAnchorMs = closeInstantUtcMs(tradingDate);
    const metaDate = new Date(metaTimeMs).toISOString().slice(0, 10);
    if (
      typeof metaPrice === "number" &&
      metaPrice > 0 &&
      metaDate === tradingDate &&
      metaTimeMs >= closeAnchorMs
    ) {
      close = metaPrice;
    }
  }

  return { tradingDate, open: opens[i], close };
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

  // Migrate whatever the legacy file priced. It predates most of the listings,
  // so insisting on all of them would throw away the two prices it does have.
  const stocks = {};
  for (const id of STOCK_IDS) {
    const price = legacy[id]?.krxClose;
    if (price > 0) stocks[id] = { krxPrice: price };
  }
  if (Object.keys(stocks).length === 0) return null;
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

/**
 * Returns why a price is unusable, or null if it is fine.
 *
 * Deliberately not a throw: the caller decides one stock's fate, and an
 * exception here used to take the other six down with it.
 */
function priceProblem(price) {
  if (!(price > 0)) return `${price} — 0보다 커야 함`;
  if (price < 1_000 || price > 10_000_000) {
    return `${price} — 범위 이탈 (1,000 ~ 10,000,000)`;
  }
  return null;
}

/**
 * 두 앵커 블록이 같은 내용인지. 재수집이 직전 실행과 똑같은 결과(같은 날짜,
 * 같은 종목, 같은 가격)를 냈다면 파일을 다시 쓸 이유가 없다 — updatedAt만
 * 바뀐 커밋은 배포까지 유발하면서 아무것도 새로 말하지 않는다. 한 종목이
 * 계속 미확정인 날 매시 캐치업 슬롯이 그 커밋을 시간마다 만들던 자리다.
 */
function sameAnchorBlock(a, b) {
  if (!a || !b) return false;
  if (a.marketDate !== b.marketDate || a.anchorTimeUtc !== b.anchorTimeUtc) {
    return false;
  }
  const aIds = Object.keys(a.stocks ?? {});
  const bIds = Object.keys(b.stocks ?? {});
  if (aIds.length !== bIds.length) return false;
  return aIds.every((id) => a.stocks[id]?.krxPrice === b.stocks?.[id]?.krxPrice);
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

  /*
   * 예전의 "세션 시각 이전 스킵" 게이트는 lastTradingDayKST 안으로 들어갔다:
   * 준비 시각(종가는 15:33 KST 샘플링 분) 전이면 목표일 자체가 어제로 물러나므로
   * 오늘의 미정산 봉을 목표로 삼는 경우가 구성상 없다. 시각으로 실행을 버리는
   * 것이 2026-08-28 사고의 절반이었다(§28) — 여기서 시계를 다시 보지 않는다.
   */
  const targetDateKST = lastTradingDayKST(session);

  console.log(`[update-baseline] 대상 거래일: ${targetDateKST} (오늘: ${todayKST()})`);

  const existing = migrateV1(loadBaseline());
  if (existing?.[session]?.marketDate === targetDateKST) {
    // "Already today's" is no longer the same as "complete": a stock can be
    // absent because its bar had not settled on the earlier run. Re-running is
    // how it gets a second chance, so only a full anchor ends the run here.
    const stored = existing[session].stocks ?? {};
    const missing = STOCK_IDS.filter((id) => !(stored[id]?.krxPrice > 0));
    if (missing.length === 0) {
      console.log(
        `[update-baseline] ${session} 앵커가 이미 ${targetDateKST} 기준으로 최신. 스킵.`
      );
      return;
    }
    console.log(
      `[update-baseline] ${session} 앵커는 ${targetDateKST} 기준이지만 ` +
        `${missing.length}종목 누락 (${missing.join(", ")}). 재수집 시도.`
    );
  }

  console.log("[update-baseline] Yahoo Finance에서 KRX 시가·종가 조회 중...");
  const results = await Promise.allSettled(
    STOCK_IDS.map((id) =>
      withRetries(`${SYMBOLS[id].displayName} 조회`, () =>
        fetchYahooDaily(SYMBOLS[id].yahooSymbol)
      )
    )
  );

  /*
   * Every rejection below is per stock, on purpose.
   *
   * All three of these checks used to abort or skip the entire run: a rejected
   * fetch threw, a bar that had not settled returned early, and a trading-date
   * mismatch between stocks threw. With two tickers that was rare; with seven
   * it is roughly three and a half times as likely, and the cost is the whole
   * day's anchor for every stock. Storing six of seven is worth far more than
   * storing none, so a bad stock is dropped here and the run continues — the
   * date check is now per stock, which also makes a cross-stock mismatch
   * impossible by construction rather than fatal.
   */
  const collected = {};
  const skipped = [];
  let fetchFailures = 0;
  for (let i = 0; i < STOCK_IDS.length; i++) {
    const stockId = STOCK_IDS[i];
    const config = SYMBOLS[stockId];
    const result = results[i];

    if (result.status === "rejected") {
      fetchFailures++;
      skipped.push(`${config.displayName}: 조회 실패 (${result.reason.message})`);
      continue;
    }

    const { tradingDate, open, close } = result.value;
    if (tradingDate !== targetDateKST) {
      skipped.push(
        `${config.displayName}: Yahoo 최신 거래일 ${tradingDate} ≠ ${targetDateKST} (미확정 또는 거래 없음)`
      );
      continue;
    }
    collected[stockId] = { open, close };
  }

  for (const reason of skipped) {
    console.warn(`[update-baseline] 스킵 — ${reason}`);
  }

  if (Object.keys(collected).length === 0) {
    /*
     * Nothing collected. WHY decides the exit code.
     *
     * Every fetch failing is an outage — Yahoo, the network, a block — and it
     * used to exit 0, which reads as a green check in the Actions list while
     * the site quietly serves yesterday's close. A red run is what makes
     * GitHub send the owner an email. Date mismatches stay a quiet exit: on a
     * Korean holiday the latest bar legitimately belongs to a previous day,
     * and §28 forbids pretending we can tell holidays apart from failures by
     * calendar.
     */
    if (fetchFailures === STOCK_IDS.length) {
      console.error(
        `[update-baseline] 전 종목 조회 실패. 기존 baseline 유지. 실패로 종료.`
      );
      process.exit(1);
    }
    console.log(
      `[update-baseline] ${targetDateKST} 기준으로 확정된 종목이 없음. ` +
        `공휴일이거나 데이터 미확정. 기존 baseline 유지. 정상 종료.`
    );
    return;
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

  let anyBlockChanged = false;
  for (const kind of sessionsToWrite) {
    const label = kind === "open" ? "시가" : "종가";
    const stocks = {};
    const dropped = [];
    for (const stockId of STOCK_IDS) {
      const config = SYMBOLS[stockId];
      const price = collected[stockId]?.[kind];
      const problem = collected[stockId]
        ? priceProblem(price)
        : "오늘 데이터 없음";

      if (problem) {
        /*
         * 사용할 수 없는 종목은 이번 앵커에서 제외한다 — 직전 값을 베끼지
         * 않는다.
         *
         * 예전에는 직전 앵커의 가격을 새 블록에 그대로 실었는데, 새 블록은
         * 오늘의 marketDate·anchorTimeUtc 아래에 기록된다. 어제의 종가를
         * 오늘 15:33의 선물가격과 짝지으면 §2.2가 금지하는 "기준시점이 어긋난
         * 예상가"가 되고, 카드는 어제 값을 오늘 날짜로 라벨링해 보여준다.
         * 제외하면 resolveAnchor()가 그 카드만 기준가 없음 상태로 떨어뜨린다
         * — 하루 어긋난 가격보다 빈 카드가 정직하다.
         *
         * 직전 블록에 이 종목이 (직전 날짜로) 있었더라도 함께 사라지는 것은
         * 의도다: 블록의 날짜는 하나뿐이라 그 날짜에 속하지 않는 가격을 남길
         * 자리가 없다. 위의 "이미 최신" 분기가 누락 종목을 보고 다음 실행에서
         * 재수집을 시도한다.
         */
        dropped.push(`${config.displayName}: ${problem}`);
        continue;
      }

      stocks[stockId] = { krxPrice: price };
      console.log(
        `[update-baseline] ${config.displayName} (${config.koreanTicker}) ` +
          `${label}: ${price.toLocaleString("ko-KR")}원`
      );
    }

    for (const reason of dropped) {
      console.warn(`[update-baseline] ${label} 앵커에서 제외 — ${reason}`);
    }

    if (Object.keys(stocks).length === 0) {
      // 전 종목이 제외되면 빈 블록으로 덮지 않고 직전 블록을 그대로 둔다.
      console.warn(
        `[update-baseline] ${label} 앵커: ${targetDateKST} 기준으로 사용 가능한 ` +
          `종목이 없음 — 기존 블록 유지`
      );
      continue;
    }

    const candidate = {
      marketDate: targetDateKST,
      anchorTimeUtc: anchorTimeUtc(targetDateKST, kind),
      stocks,
    };
    if (sameAnchorBlock(candidate, next[kind])) {
      console.log(`[update-baseline] ${label} 앵커: 직전 실행과 동일 — 재기록 생략`);
      continue;
    }
    next[kind] = candidate;
    anyBlockChanged = true;
  }

  if (!anyBlockChanged) {
    // 파일이 그대로면 워크플로도 커밋·배포하지 않는다.
    console.log(
      `[update-baseline] 갱신된 앵커 없음. 기존 baseline 유지. 정상 종료.`
    );
    return;
  }

  next.updatedAt = new Date().toISOString();
  writeBaseline(next);

  console.log(
    `[update-baseline] baseline.json 갱신 완료 (${targetDateKST}, ${sessionsToWrite.join("+")}, ` +
      `${Object.keys(collected).length}/${STOCK_IDS.length}종목 신규 수집)`
  );
}

main().catch((err) => {
  console.error("[update-baseline] Fatal:", err.message);
  process.exit(1);
});
