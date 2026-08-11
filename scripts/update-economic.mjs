/**
 * scripts/update-economic.mjs
 *
 * Refreshes public/data/economic.json with the upcoming US release calendar.
 *
 * Source: FRED (St. Louis Fed). It is the only free machine-readable calendar
 * for these releases — BLS answers its own schedule pages with HTTP 403 to any
 * automated client, and changing the User-Agent does not help. FRED needs a free
 * API key, passed as FRED_API_KEY.
 *
 * US federal statistics carry no copyright (17 U.S.C. §105), so unlike the news
 * feeds there is no licence to negotiate here. Attribution is still shown.
 *
 * FOMC is deliberately absent. FRED does carry an "FOMC Press Release" release,
 * but its release *dates* are the days the underlying data was updated, not the
 * eight meetings a year — queried over a 38-day window it returns 39 dates, one
 * per day. A card reading "FOMC 금리결정 08/13" on a day with no meeting is worse
 * than no card, so the Fed's own calendar is the only acceptable source and it is
 * a separate job.
 *
 * What this deliberately does NOT collect: market consensus. "CPI expected 3.0%"
 * is a commercial product — the agencies do not forecast their own releases — so
 * the cards show a date and, once published, the actual figure. Inventing an
 * expectation would be exactly the kind of false certainty CLAUDE.md §10 forbids.
 *
 * Exit codes:
 *   0  – updated, or skipped safely (nothing changed, no key configured)
 *   1  – fatal error; the existing file is left untouched
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");
const OUT_PATH = join(DATA_DIR, "economic.json");

const FRED_BASE = "https://api.stlouisfed.org/fred";
const USER_AGENT = "Mozilla/5.0 (compatible; kospinow-bot/1.0)";
const TIMEOUT_MS = 20_000;

/** How far ahead to keep dates. Matches ECONOMIC_WINDOW_DAYS on the client. */
const WINDOW_DAYS = 31;
/** How far back to keep them, so a just-published figure stays visible. */
const LOOKBACK_DAYS = 7;

/**
 * The releases the dashboard tracks.
 *
 * `fredReleaseName` is matched case-insensitively against FRED's own release
 * names instead of hard-coding numeric ids. An id guessed wrong would silently
 * point a card at the wrong release; the names are stable, the ids are an
 * implementation detail of someone else's database.
 *
 * `easternTime` is the agency's standard publication time. Stored as Eastern
 * because that is what they announce, and converted through America/New_York so
 * the result is correct in both halves of the year — 08:30 in New York is 21:30
 * in Seoul in summer and 22:30 in winter.
 */
const INDICATORS = [
  { id: "cpi", label: "소비자물가 (CPI)", fredReleaseName: "consumer price index", easternTime: [8, 30], source: "BLS" },
  { id: "employment", label: "고용보고서", fredReleaseName: "employment situation", easternTime: [8, 30], source: "BLS" },
  { id: "ppi", label: "생산자물가 (PPI)", fredReleaseName: "producer price index", easternTime: [8, 30], source: "BLS" },
  { id: "pce", label: "개인소비지출 (PCE)", fredReleaseName: "personal income and outlays", easternTime: [8, 30], source: "BEA" },
  { id: "retail", label: "소매판매", fredReleaseName: "advance monthly sales for retail", easternTime: [8, 30], source: "Census" },
  { id: "gdp", label: "GDP", fredReleaseName: "gross domestic product", easternTime: [8, 30], source: "BEA" },
];

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function fredJson(path, params, apiKey) {
  const url = new URL(`${FRED_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`FRED HTTP ${res.status} for ${path}`);
  }
  return res.json();
}

// ─── Time ─────────────────────────────────────────────────────────────────────

/**
 * The UTC instant of a wall-clock time in New York.
 *
 * Built by probing rather than by assuming an offset: format a first guess in
 * America/New_York, measure how far off it landed, and correct. That keeps the
 * result right across daylight saving without a timezone library.
 */
function easternToUtcIso(dateStr, hour, minute) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guess));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);

  // What the guess actually reads as in New York, expressed as a UTC timestamp.
  const seen = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute")
  );

  return new Date(guess + (guess - seen)).toISOString();
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ─── Collection ───────────────────────────────────────────────────────────────

/** Resolves each indicator to a FRED release id by matching on name. */
async function resolveReleaseIds(apiKey) {
  const json = await fredJson("/releases", { limit: 1000 }, apiKey);
  const releases = json?.releases ?? [];
  if (releases.length === 0) throw new Error("FRED returned no releases");

  const resolved = [];
  for (const indicator of INDICATORS) {
    const match = releases.find((r) =>
      String(r.name ?? "").toLowerCase().includes(indicator.fredReleaseName)
    );
    if (!match) {
      // One unmatched name must not cost the whole calendar.
      console.warn(
        `[update-economic] no FRED release matched "${indicator.fredReleaseName}" — skipping ${indicator.id}`
      );
      continue;
    }
    resolved.push({ ...indicator, releaseId: match.id, fredName: match.name });
    console.log(
      `[update-economic] ${indicator.id} → release ${match.id} (${match.name})`
    );
  }
  return resolved;
}

/** Scheduled dates for one release inside the window. */
async function fetchReleaseDates(indicator, apiKey, from, to) {
  const json = await fredJson(
    `/release/dates`,
    {
      release_id: indicator.releaseId,
      realtime_start: from,
      realtime_end: to,
      include_release_dates_with_no_data: "true",
      sort_order: "asc",
      limit: 100,
    },
    apiKey
  );
  return (json?.release_dates ?? [])
    .map((r) => r.date)
    .filter((d) => typeof d === "string" && d >= from && d <= to);
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function loadExisting() {
  if (!existsSync(OUT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(OUT_PATH, "utf-8"));
  } catch {
    return null;
  }
}

/** Atomic write, so a crash never leaves a truncated calendar behind. */
function writeOut(payload) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${OUT_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(tmp, OUT_PATH);
}

/** Compares everything except updatedAt, so an unchanged calendar is not committed. */
function sameCalendar(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a.releases) === JSON.stringify(b.releases);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.FRED_API_KEY ?? "";
  if (apiKey === "") {
    // Not an error: a fork without the secret should still build.
    console.log(
      "[update-economic] FRED_API_KEY not set — leaving economic.json untouched."
    );
    return;
  }

  const from = shiftDays(todayUtc(), -LOOKBACK_DAYS);
  const to = shiftDays(todayUtc(), WINDOW_DAYS);
  console.log(`[update-economic] window ${from} … ${to}`);

  const resolved = await resolveReleaseIds(apiKey);
  if (resolved.length === 0) throw new Error("no releases could be resolved");

  const settled = await Promise.allSettled(
    resolved.map((i) => fetchReleaseDates(i, apiKey, from, to))
  );

  const releases = [];
  settled.forEach((result, idx) => {
    const indicator = resolved[idx];
    if (result.status === "rejected") {
      console.warn(
        `[update-economic] dates failed for ${indicator.id}: ${result.reason?.message}`
      );
      return;
    }
    for (const date of result.value) {
      releases.push({
        id: indicator.id,
        label: indicator.label,
        source: indicator.source,
        date,
        releaseAtUtc: easternToUtcIso(
          date,
          indicator.easternTime[0],
          indicator.easternTime[1]
        ),
      });
    }
  });

  if (releases.length === 0) throw new Error("no release dates in window");

  releases.sort((a, b) => a.releaseAtUtc.localeCompare(b.releaseAtUtc));

  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    windowStart: from,
    windowEnd: to,
    releases,
  };

  const existing = loadExisting();
  if (sameCalendar(existing, payload)) {
    console.log("[update-economic] calendar unchanged — not rewriting.");
    return;
  }

  writeOut(payload);
  console.log(
    `[update-economic] wrote ${releases.length} dates across ${resolved.length} releases.`
  );
}

main().catch((err) => {
  console.error("[update-economic] Fatal:", err.message);
  process.exit(1);
});
