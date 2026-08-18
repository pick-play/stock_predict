import type { D1Database } from '@cloudflare/workers-types';

/**
 * Attendance: how many days a member has shown up, and how many in a row.
 *
 * Recorded on the user row, not in a visits table. A log would grow by a row per
 * member per day forever to answer two questions three columns already answer,
 * and rows written is the binding limit on the free plan. Here a member costs at
 * most one UPDATE a day — the date guard makes every later visit that day free.
 *
 * Days are Seoul calendar days. Attendance is a question about days, and the
 * reader's day is the Korean one whatever the server thinks.
 */

export interface Attendance {
  /** Distinct days this member has been seen, including today. */
  visitDays: number;
  /** Consecutive days ending today. */
  visitStreak: number;
}

/** "YYYY-MM-DD" in Asia/Seoul. */
export function seoulDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // en-CA already formats as YYYY-MM-DD.
  return parts;
}

/** The Seoul calendar day before `date` ("YYYY-MM-DD" in, same out). */
export function previousSeoulDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const previous = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
  return previous.toISOString().slice(0, 10);
}

/**
 * Works out the new attendance for a visit today.
 *
 * Pure, so the streak rules are testable without a database:
 *   - same day again  → unchanged, and the caller writes nothing
 *   - yesterday       → streak continues
 *   - a gap, or never → streak restarts at 1
 */
export function nextAttendance(
  current: { lastVisitDate: string | null; visitDays: number; visitStreak: number },
  today: string
): Attendance & { changed: boolean } {
  if (current.lastVisitDate === today) {
    return {
      visitDays: current.visitDays,
      visitStreak: current.visitStreak,
      changed: false,
    };
  }

  const continues =
    current.lastVisitDate !== null &&
    current.lastVisitDate === previousSeoulDate(today);

  return {
    visitDays: current.visitDays + 1,
    visitStreak: continues ? current.visitStreak + 1 : 1,
    changed: true,
  };
}

interface UserVisitRow {
  last_visit_date: string | null;
  visit_days: number | null;
  visit_streak: number | null;
}

/**
 * Records today's visit and returns the member's attendance.
 *
 * Called from GET /api/auth/me, which the client hits once when a page mounts.
 * Not from requireAuth: that runs on every authenticated request, and posting a
 * comment is not a second attendance.
 */
export async function recordVisit(
  db: D1Database,
  userId: number,
  now: Date = new Date()
): Promise<Attendance> {
  const today = seoulDate(now);

  const row = await db
    .prepare(
      'SELECT last_visit_date, visit_days, visit_streak FROM users WHERE id = ?'
    )
    .bind(userId)
    .first<UserVisitRow>();

  const current = {
    lastVisitDate: row?.last_visit_date ?? null,
    visitDays: row?.visit_days ?? 0,
    visitStreak: row?.visit_streak ?? 0,
  };

  const next = nextAttendance(current, today);
  if (!next.changed) {
    return { visitDays: next.visitDays, visitStreak: next.visitStreak };
  }

  await db
    .prepare(
      'UPDATE users SET last_visit_date = ?, visit_days = ?, visit_streak = ? WHERE id = ?'
    )
    .bind(today, next.visitDays, next.visitStreak, userId)
    .run();

  return { visitDays: next.visitDays, visitStreak: next.visitStreak };
}
