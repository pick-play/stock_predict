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

  if (!data.marketDate) fail("marketDate missing");
  if (!data.capturedAt) fail("capturedAt missing");
  if (!data.stocks) { fail("stocks missing"); return; }

  const marketDate = new Date(data.marketDate);
  if (isNaN(marketDate.getTime())) fail(`marketDate invalid: ${data.marketDate}`);
  if (marketDate.getTime() > Date.now()) fail(`marketDate is in the future: ${data.marketDate}`);

  let samsungDate = null;
  let skHynixDate = null;

  for (const [id, stock] of Object.entries(data.stocks)) {
    // 0-value baselines are valid initial state (baseline not yet configured)
    if (stock.krxClose === 0 && stock.binanceReferencePrice === 0) {
      console.log(`[validate] INFO: ${id} baseline not yet configured (zeros OK for initial state)`);
      continue;
    }
    if (!(stock.krxClose > 0)) fail(`${id}: krxClose must be > 0`);
    if (!(stock.binanceReferencePrice > 0)) fail(`${id}: binanceReferencePrice must be > 0`);

    if (id === "samsung") samsungDate = data.marketDate;
    if (id === "skHynix") skHynixDate = data.marketDate;
  }

  if (samsungDate && skHynixDate && samsungDate !== skHynixDate) {
    fail(`Samsung and SK Hynix baseline dates differ: ${samsungDate} vs ${skHynixDate}`);
  }

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
