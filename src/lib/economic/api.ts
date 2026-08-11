/**
 * Reads the committed US release calendar.
 *
 * Served from the site's own origin, like baseline.json — no proxy, no CORS, and
 * no request quota, because the calendar changes once a day and a daily cron can
 * simply commit it. FRED is reachable from a US Actions runner, unlike the
 * futures API that forced the browser to do that work itself.
 */

import { z } from "zod";
import type { EconomicCalendar, EconomicRelease } from "../../types/economic";
import {
  ECONOMIC_PATH,
  ECONOMIC_STALE_THRESHOLD_MS,
} from "../../config/economic";

const ReleaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  releaseAtUtc: z.string().datetime(),
});

const CalendarSchema = z.object({
  schemaVersion: z.number(),
  updatedAt: z.string().datetime(),
  windowStart: z.string(),
  windowEnd: z.string(),
  releases: z.array(ReleaseSchema),
});

/**
 * Returns null on anything unexpected, including a snapshot nobody has updated
 * in days.
 *
 * The staleness check is the point of this function beyond fetching: a calendar
 * is a promise about the future, and a stale one quietly becomes wrong rather
 * than merely old. If the daily workflow has stopped, showing nothing is the
 * honest outcome.
 */
export async function fetchEconomicCalendar(
  signal?: AbortSignal
): Promise<EconomicCalendar | null> {
  try {
    const res = await fetch(`${ECONOMIC_PATH}?t=${Date.now()}`, {
      cache: "no-store",
      signal,
    });
    if (!res.ok) return null;

    const parsed = CalendarSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.warn("[economic] schema validation failed");
      return null;
    }

    const ageMs = Date.now() - new Date(parsed.data.updatedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > ECONOMIC_STALE_THRESHOLD_MS) {
      console.warn(
        `[economic] calendar not updated in ${Math.round(ageMs / 86_400_000)}일 — hiding`
      );
      return null;
    }

    return parsed.data;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.warn("[economic] fetch failed", err);
    }
    return null;
  }
}

/** Releases still ahead of `now`, soonest first. */
export function upcomingReleases(
  calendar: EconomicCalendar,
  nowMs: number = Date.now()
): EconomicRelease[] {
  return calendar.releases
    .filter((r) => new Date(r.releaseAtUtc).getTime() > nowMs)
    .sort((a, b) => a.releaseAtUtc.localeCompare(b.releaseAtUtc));
}

/**
 * Releases already published, newest first.
 *
 * Kept because a figure that landed this morning is often more interesting than
 * one due next week, and the collector deliberately looks a week back so this is
 * never empty right after a release.
 */
export function pastReleases(
  calendar: EconomicCalendar,
  nowMs: number = Date.now()
): EconomicRelease[] {
  return calendar.releases
    .filter((r) => new Date(r.releaseAtUtc).getTime() <= nowMs)
    .sort((a, b) => b.releaseAtUtc.localeCompare(a.releaseAtUtc));
}
