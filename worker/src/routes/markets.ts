/**
 * GET /api/markets — index/commodity/FX quotes for the ticker tape.
 *
 * Exists because the browser cannot call Yahoo Finance directly: the endpoint
 * sends no Access-Control-Allow-Origin, so a page fetch is blocked. This route
 * makes the request server-side and re-serves it with the board's CORS rules.
 *
 * Two upstream calls with different lifetimes:
 *   spark  — every price in one request, refreshed every SPARK_TTL_MS
 *   chart  — the exchange's session window, refreshed every SESSION_TTL_MS
 *
 * The session window is what makes the 장중/장 마감 badge honest without a
 * hand-maintained holiday calendar: Yahoo reports the session the exchange is
 * actually running, so a closed holiday simply never has `now` inside it.
 *
 * Nothing here is real-time in the licensed sense. Index values are delayed by
 * roughly a quarter hour on this source, and the response says so per
 * instrument (`asOf`) so the UI can label it rather than imply a live tick.
 */

import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env } from '../types';

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const YAHOO_USER_AGENT = 'Mozilla/5.0 (compatible; kospinow-ticker/1.0)';
const UPSTREAM_TIMEOUT_MS = 8_000;

const SPARK_TTL_MS = 15_000;
const SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * Every symbol the tape can show, in display order.
 *
 * `crypto` marks a market with no session at all — it never gets a 장 마감
 * badge. Bitcoin is listed here so the tape still has a value when the
 * browser's Binance socket is unavailable; when that socket is up the client
 * overrides this entry with the live one.
 */
const INSTRUMENTS: ReadonlyArray<{
  id: string;
  symbol: string;
  crypto?: true;
}> = [
  { id: 'nasdaq100', symbol: '^NDX' },
  { id: 'sp500', symbol: '^GSPC' },
  { id: 'dow', symbol: '^DJI' },
  { id: 'kospi', symbol: '^KS11' },
  { id: 'kosdaq', symbol: '^KQ11' },
  { id: 'gold', symbol: 'GC=F' },
  { id: 'oil', symbol: 'CL=F' },
  { id: 'dollar', symbol: 'DX-Y.NYB' },
  { id: 'ust10y', symbol: '^TNX' },
  { id: 'bitcoin', symbol: 'BTC-USD', crypto: true },
];

export type MarketStatus = 'open' | 'closed' | 'unknown';

export interface MarketQuote {
  id: string;
  price: number;
  previousClose: number;
  changePercent: number;
  /** ISO time of the newest datapoint behind `price`, for staleness labelling. */
  asOf: string;
  status: MarketStatus;
  /** ISO bounds of the session `status` was derived from; null for crypto. */
  sessionStart: string | null;
  sessionEnd: string | null;
}

// ─── Upstream fetch ──────────────────────────────────────────────────────────

async function yahooJson(path: string): Promise<unknown> {
  const res = await fetch(`${YAHOO_BASE}${path}`, {
    headers: { 'User-Agent': YAHOO_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status} for ${path}`);
  }
  return res.json();
}

interface SparkEntry {
  timestamp?: number[];
  close?: (number | null)[];
  previousClose?: number;
  chartPreviousClose?: number;
}

/** Last non-null close and its timestamp. Yahoo pads the series with nulls. */
function lastPoint(
  entry: SparkEntry
): { price: number; timestampSec: number } | null {
  const closes = entry.close ?? [];
  const stamps = entry.timestamp ?? [];
  for (let i = closes.length - 1; i >= 0; i--) {
    const price = closes[i];
    const stamp = stamps[i];
    if (typeof price === 'number' && price > 0 && typeof stamp === 'number') {
      return { price, timestampSec: stamp };
    }
  }
  return null;
}

async function fetchSpark(): Promise<Record<string, SparkEntry>> {
  const symbols = INSTRUMENTS.map((i) => encodeURIComponent(i.symbol)).join(',');
  const json = await yahooJson(
    `/v8/finance/spark?symbols=${symbols}&range=1d&interval=5m`
  );
  if (json === null || typeof json !== 'object') {
    throw new Error('Yahoo spark: unexpected payload');
  }
  // The spark payload is keyed by symbol at the top level, unlike every other
  // Yahoo endpoint, which nests results under a wrapper object.
  return json as Record<string, SparkEntry>;
}

interface SessionWindow {
  startMs: number;
  endMs: number;
}

/** The exchange session for one symbol, or null when Yahoo omits it. */
async function fetchSession(symbol: string): Promise<SessionWindow | null> {
  const json = (await yahooJson(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  )) as {
    chart?: {
      result?: Array<{
        meta?: {
          currentTradingPeriod?: {
            regular?: { start?: number; end?: number };
          };
        };
      }>;
    };
  };

  const regular =
    json?.chart?.result?.[0]?.meta?.currentTradingPeriod?.regular;
  const start = regular?.start;
  const end = regular?.end;
  if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
    return null;
  }
  return { startMs: start * 1000, endMs: end * 1000 };
}

// ─── Caching ─────────────────────────────────────────────────────────────────

/**
 * Cached in module scope rather than the Cache API because a Worker isolate is
 * reused across requests for as long as it stays warm, which is enough to keep
 * the tape's fan-in down to roughly one upstream call per TTL. A cold isolate
 * simply pays for one fetch.
 */
interface CacheSlot<T> {
  value: T;
  storedAtMs: number;
}

let sparkCache: CacheSlot<Record<string, SparkEntry>> | null = null;
const sessionCache = new Map<string, CacheSlot<SessionWindow | null>>();

function fresh<T>(slot: CacheSlot<T> | null | undefined, ttlMs: number): boolean {
  if (!slot) return false;
  const age = Date.now() - slot.storedAtMs;
  return age >= 0 && age < ttlMs;
}

async function getSpark(): Promise<Record<string, SparkEntry>> {
  if (fresh(sparkCache, SPARK_TTL_MS)) return sparkCache!.value;

  try {
    const value = await fetchSpark();
    sparkCache = { value, storedAtMs: Date.now() };
    return value;
  } catch (err) {
    // A stale price beats an empty tape, but only while the client can still
    // see how old it is — every quote carries its own asOf for that reason.
    if (sparkCache) {
      console.warn('[markets] spark refresh failed, serving cached', err);
      return sparkCache.value;
    }
    throw err;
  }
}

async function getSession(symbol: string): Promise<SessionWindow | null> {
  const slot = sessionCache.get(symbol);
  if (fresh(slot, SESSION_TTL_MS)) return slot!.value;

  try {
    const value = await fetchSession(symbol);
    sessionCache.set(symbol, { value, storedAtMs: Date.now() });
    return value;
  } catch (err) {
    console.warn(`[markets] session refresh failed for ${symbol}`, err);
    return slot ? slot.value : null;
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function handleGetMarkets(
  request: Request,
  env: Env
): Promise<Response> {
  let spark: Record<string, SparkEntry>;
  try {
    spark = await getSpark();
  } catch (err) {
    console.error('[markets] upstream unavailable', err);
    return errorResponse(
      'upstream-unavailable',
      '시세 제공처에 연결할 수 없습니다.',
      503,
      request,
      env
    );
  }

  // Sessions are fetched for every non-crypto symbol at once; one exchange
  // failing must not cost the others their badge.
  const sessionTargets = INSTRUMENTS.filter((i) => !i.crypto);
  const sessions = new Map<string, SessionWindow | null>();
  await Promise.all(
    sessionTargets.map(async (i) => {
      sessions.set(i.symbol, await getSession(i.symbol));
    })
  );

  const nowMs = Date.now();
  const quotes: MarketQuote[] = [];

  for (const instrument of INSTRUMENTS) {
    const entry = spark[instrument.symbol];
    if (!entry) continue;

    const point = lastPoint(entry);
    const previousClose = entry.previousClose ?? entry.chartPreviousClose;
    if (!point || typeof previousClose !== 'number' || previousClose <= 0) {
      continue;
    }

    let status: MarketStatus;
    let sessionStart: string | null = null;
    let sessionEnd: string | null = null;

    if (instrument.crypto) {
      status = 'open';
    } else {
      const session = sessions.get(instrument.symbol) ?? null;
      if (session) {
        status =
          nowMs >= session.startMs && nowMs < session.endMs ? 'open' : 'closed';
        sessionStart = new Date(session.startMs).toISOString();
        sessionEnd = new Date(session.endMs).toISOString();
      } else {
        // No session window means no defensible claim either way. Saying
        // "unknown" is better than guessing 장중 from a weekday.
        status = 'unknown';
      }
    }

    quotes.push({
      id: instrument.id,
      price: point.price,
      previousClose,
      changePercent: (point.price / previousClose - 1) * 100,
      asOf: new Date(point.timestampSec * 1000).toISOString(),
      status,
      sessionStart,
      sessionEnd,
    });
  }

  if (quotes.length === 0) {
    return errorResponse(
      'no-quotes',
      '표시할 시세가 없습니다.',
      503,
      request,
      env
    );
  }

  const response = jsonResponse(
    { generatedAt: new Date().toISOString(), quotes },
    200,
    request,
    env
  );
  // Lets the edge and the browser absorb bursts without shortening the window
  // in which a reader sees a genuinely current number.
  response.headers.set('Cache-Control', 'public, max-age=10');
  return response;
}
