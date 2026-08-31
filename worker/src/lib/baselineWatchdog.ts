/**
 * Baseline freshness watchdog — the clock that is not GitHub's.
 *
 * GitHub's cron is best-effort and for this repo has now failed three separate
 * ways: 2026-08-27 every slot silently skipped, 2026-08-28 all slots delivered
 * 9-12 hours late, 2026-08-31 the whole trading day passed without a single
 * scheduled run. The script-side fix (converge on lastTradingDayKST) survives
 * late delivery, but nothing on GitHub's side can survive NO delivery — a cron
 * that never fires cannot catch itself up.
 *
 * So the schedule that actually guarantees the close anchor lives here, on
 * Cloudflare's cron, which is independent infrastructure. Each tick answers one
 * question: does the deployed site carry the close for the most recent trading
 * day? If yes, do nothing (the normal case — GitHub's own slots usually get
 * there first). If not, work out which half is missing:
 *
 *   - git is stale too        → dispatch update-baseline.yml (the fetch never ran)
 *   - git fresh, site stale   → dispatch deploy-pages.yml (the anchor is committed
 *                               but unpublished — the 2026-08-12 failure class)
 *
 * Dispatch needs GITHUB_DISPATCH_TOKEN (a token with Actions write on the
 * repo). Missing token follows the project's is-configured rule: the watchdog
 * logs and stands down instead of throwing.
 *
 * KRX holidays are invisible from here (the site judges holidays by observed
 * session, not calendar — §28 of CLAUDE.md). On a weekday holiday the anchor
 * legitimately stays on the previous day, so every tick that evening dispatches
 * a run that exits in the script's quiet date-mismatch branch. That is bounded
 * by the cron schedule (a handful of ~30s no-op runs on a public repo) and is
 * the price of not hardcoding a holiday list.
 */

import type { Env } from '../types';

const REPO = 'pick-play/stock_predict';
const SITE_BASELINE_URL = 'https://kospinow.com/data/baseline.json';
const RAW_BASELINE_URL = `https://raw.githubusercontent.com/${REPO}/main/public/data/baseline.json`;

// KST is UTC+9 with no daylight saving, so a fixed offset is exact.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Don't chase today's close before 15:45 KST: the bar settles at 15:33 and
 * GitHub's own 15:40 slot deserves first shot. Cloudflare's cron fires at :45
 * anyway; this guard is for manual/rescheduled invocations.
 */
const READY_HOUR_KST = 15;
const READY_MINUTE_KST = 45;

/** A Date whose getUTC* accessors read as Korean wall-clock time. */
function kstClock(now: Date): Date {
  return new Date(now.getTime() + KST_OFFSET_MS);
}

/** Same convergence rule as scripts/update-baseline.mjs: latest KST weekday. */
export function lastTradingDayKST(now: Date): string {
  const kst = kstClock(now);
  const day = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) {
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return day.toISOString().slice(0, 10);
}

/** The close anchor's trading date inside a baseline.json body, or null. */
function closeMarketDate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const close = (body as { close?: { marketDate?: unknown } }).close;
  const date = close?.marketDate;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

async function fetchCloseDate(url: string): Promise<string | null> {
  const res = await fetch(`${url}?t=${Date.now()}`, {
    headers: { accept: 'application/json' },
    // The whole point is to see what is published *now*, not a cached copy.
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) return null;
  return closeMarketDate(await res.json().catch(() => null));
}

async function dispatchWorkflow(
  env: Env,
  workflowFile: string,
  inputs?: Record<string, string>
): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        // GitHub's API rejects requests without a User-Agent.
        'user-agent': 'kospinow-baseline-watchdog',
      },
      body: JSON.stringify({ ref: 'main', ...(inputs ? { inputs } : {}) }),
    }
  );
  if (res.status !== 204) {
    console.error(
      `[baseline-watchdog] dispatch ${workflowFile} failed: ${res.status} ${await res
        .text()
        .catch(() => '')}`
    );
    return false;
  }
  console.log(`[baseline-watchdog] dispatched ${workflowFile}`);
  return true;
}

export async function ensureBaselineFresh(env: Env, now = new Date()): Promise<void> {
  const target = lastTradingDayKST(now);
  const kst = kstClock(now);
  const todayKST = kst.toISOString().slice(0, 10);

  if (
    target === todayKST &&
    (kst.getUTCHours() < READY_HOUR_KST ||
      (kst.getUTCHours() === READY_HOUR_KST && kst.getUTCMinutes() < READY_MINUTE_KST))
  ) {
    return; // today's bar isn't settled yet — nothing can be stale
  }

  const siteDate = await fetchCloseDate(SITE_BASELINE_URL).catch(() => null);
  // ISO date strings order lexicographically.
  if (siteDate !== null && siteDate >= target) {
    return; // the published site already carries the latest close — the normal case
  }

  if (!env.GITHUB_DISPATCH_TOKEN) {
    console.error(
      `[baseline-watchdog] site close anchor is ${siteDate ?? 'unreadable'} (want ${target}) ` +
        'but GITHUB_DISPATCH_TOKEN is not set; cannot dispatch'
    );
    return;
  }

  const gitDate = await fetchCloseDate(RAW_BASELINE_URL).catch(() => null);
  if (gitDate !== null && gitDate >= target) {
    // The anchor is committed but the published site lags: only the deploy died.
    await dispatchWorkflow(env, 'deploy-pages.yml');
    return;
  }

  console.log(
    `[baseline-watchdog] close anchor stale (site=${siteDate}, git=${gitDate}, want=${target})`
  );
  await dispatchWorkflow(env, 'update-baseline.yml', { session: 'close' });
}
