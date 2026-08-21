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
    } else if (marketDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      fail(`${kind}: marketDate is in the future: ${anchor.marketDate}`);
    }

    const anchorTime = new Date(anchor.anchorTimeUtc);
    if (!anchor.anchorTimeUtc || isNaN(anchorTime.getTime())) {
      fail(`${kind}: anchorTimeUtc invalid: ${anchor.anchorTimeUtc}`);
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
