/**
 * Once-a-day table hygiene, ridden on the baseline watchdog's cron.
 *
 * Two tables accumulate rows nothing ever reads again:
 *  - sessions past expires_at (requireAuth filters them out but never deletes)
 *  - login_attempts older than 24h (the rate-limit window is 10 minutes)
 *
 * Deleting them hourly would trade one kind of churn for another, so the purge
 * only runs on the tick whose hour makes it roughly once daily: the first
 * weekday tick (15:45 KST = 06:45 UTC) and the first weekend tick (11:45 KST =
 * 02:45 UTC), matching wrangler.toml's [triggers] crons. No lastPurge state to
 * store — the cron hour IS the state, and a missed day just means yesterday's
 * dead rows wait one more day, which nothing notices.
 */

import type { Env } from '../types';

/** True only on the one cron tick per day the purge should ride. */
export function isDailyPurgeTick(now: Date): boolean {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const weekday = day >= 1 && day <= 5;
  // Cron: "45 6-14 * * MON-FRI" and "45 2,8 * * SAT,SUN" (UTC).
  return weekday ? hour === 6 : hour === 2;
}

const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function purgeStaleRows(env: Env, now = new Date()): Promise<void> {
  const nowIso = now.toISOString();
  const attemptCutoff = new Date(
    now.getTime() - LOGIN_ATTEMPT_RETENTION_MS
  ).toISOString();

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso),
      env.DB.prepare('DELETE FROM login_attempts WHERE created_at < ?').bind(
        attemptCutoff
      ),
    ]);
    console.log('[db-maintenance] purged expired sessions and old login attempts');
  } catch (error) {
    // Hygiene must never take the watchdog down with it; tomorrow's tick retries.
    console.warn('[db-maintenance] purge failed', error);
  }
}
