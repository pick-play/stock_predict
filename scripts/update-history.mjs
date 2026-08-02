/**
 * Appends the current latest.json snapshot to history.json
 * Applies retention: 7-day 5-min data, 8–30d 30-min downsampled, older discarded.
 * Run: node scripts/update-history.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(dirname(__dirname), "public", "data");

const RECENT_DAYS = 7;
const MEDIUM_DAYS = 30;
const RECENT_INTERVAL_MS = 5 * 60 * 1000;   // 5 min
const MEDIUM_INTERVAL_MS = 30 * 60 * 1000;  // 30 min

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function downsample(entries, intervalMs) {
  const buckets = new Map();
  for (const entry of entries) {
    const t = new Date(entry.timestamp).getTime();
    const bucket = Math.floor(t / intervalMs) * intervalMs;
    if (!buckets.has(bucket)) {
      buckets.set(bucket, entry);
    }
  }
  return Array.from(buckets.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function applyRetention(history) {
  const now = Date.now();
  const recentCutoff = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const mediumCutoff = now - MEDIUM_DAYS * 24 * 60 * 60 * 1000;

  const recent = history.filter((e) => new Date(e.timestamp).getTime() >= recentCutoff);
  const medium = history.filter(
    (e) =>
      new Date(e.timestamp).getTime() >= mediumCutoff &&
      new Date(e.timestamp).getTime() < recentCutoff
  );

  const mediumDownsampled = downsample(medium, MEDIUM_INTERVAL_MS);
  const recentDownsampled = downsample(recent, RECENT_INTERVAL_MS);

  return [...mediumDownsampled, ...recentDownsampled];
}

function main() {
  console.log("[update-history] Starting...");

  const latestPath = join(DATA_DIR, "latest.json");
  const historyPath = join(DATA_DIR, "history.json");

  const latest = loadJson(latestPath);
  if (!latest) {
    console.error("[update-history] No latest.json found. Aborting.");
    process.exit(1);
  }

  if (!latest.generatedAt) {
    console.error("[update-history] latest.json missing generatedAt. Aborting.");
    process.exit(1);
  }

  const history = loadJson(historyPath) ?? [];

  const entry = {
    timestamp: latest.generatedAt,
    stocks: Object.fromEntries(
      Object.entries(latest.stocks).map(([id, stock]) => [
        id,
        {
          estimatedPrice: stock.estimatedPrice,
          changeRate: stock.changeRate,
          currentBinancePrice: stock.currentBinancePrice,
          confidenceScore: stock.confidenceScore,
        },
      ])
    ),
  };

  // Deduplicate by timestamp
  const existing = history.filter((e) => e.timestamp !== entry.timestamp);
  const updated = applyRetention([...existing, entry]);

  writeFileSync(historyPath, JSON.stringify(updated, null, 2));
  console.log(`[update-history] history.json updated (${updated.length} entries)`);
}

main();
