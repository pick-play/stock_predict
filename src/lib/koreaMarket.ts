import { KRX_TIMEZONE, KRX_OPEN_HOUR, KRX_OPEN_MINUTE, KRX_CLOSE_HOUR, KRX_CLOSE_MINUTE } from "../config/market";

export type MarketStatus =
  | "trading"
  | "closed"
  | "overnight"
  | "weekend"
  | "holiday-unknown"
  | "data-stale"
  | "baseline-needed";

export function getSeoulDate(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KRX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  // h23 still yields "24" for midnight in some engines — same guard as
  // easternParts below.
  const rawHour = get("hour");

  return {
    year: parseInt(get("year")),
    month: parseInt(get("month")),
    day: parseInt(get("day")),
    hour: rawHour === "24" ? 0 : parseInt(rawHour),
    minute: parseInt(get("minute")),
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
  };
}

/** Wall-clock weekday and minutes-past-midnight in New York. */
function easternParts(date: Date): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  // h23 still yields "24" for midnight in some engines.
  const hour = get("hour") === "24" ? 0 : parseInt(get("hour"));
  return {
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
    minutes: hour * 60 + parseInt(get("minute")),
  };
}

/** 16:00 in New York — the closing bell, in minutes past midnight. */
const US_CLOSE_MINUTES = 16 * 60;

/**
 * True while no major market is open — what the site calls 주말 참고가격.
 *
 * The weekend starts at the American close, not at midnight in Seoul (owner
 * decision, 2026-08-22). Saturday in Korea begins while New York is still
 * trading Friday afternoon, and for those hours the estimate moves on real
 * overseas volume; calling that a weekend and warning about thin liquidity was
 * describing the wrong market.
 *
 * The boundary is computed from New York's own clock rather than a fixed KST
 * hour, because the gap is nine hours under DST and ten hours without it — a
 * hard-coded 05:00 or 06:00 would be wrong for half the year.
 *
 * The end of the window is unchanged: Monday in Seoul. After that the site is
 * back in its ordinary overnight state ahead of the domestic open.
 */
export function isWeekend(date: Date = new Date()): boolean {
  const { dayOfWeek: seoulDay } = getSeoulDate(date);

  // Sunday in Seoul is Saturday or early Sunday in New York: closed either way.
  if (seoulDay === 0) return true;
  if (seoulDay !== 6) return false;

  const eastern = easternParts(date);
  // Saturday in Seoul, which is Friday in New York until its evening.
  if (eastern.dayOfWeek === 5) return eastern.minutes >= US_CLOSE_MINUTES;
  return true;
}

export function isKrxTradingHours(date: Date = new Date()): boolean {
  if (isWeekend(date)) return false;
  const { hour, minute } = getSeoulDate(date);
  const totalMinutes = hour * 60 + minute;
  const openMinutes = KRX_OPEN_HOUR * 60 + KRX_OPEN_MINUTE;
  const closeMinutes = KRX_CLOSE_HOUR * 60 + KRX_CLOSE_MINUTE;
  return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
}

export function getMarketStatus(date: Date = new Date()): MarketStatus {
  if (isWeekend(date)) return "weekend";
  if (isKrxTradingHours(date)) return "trading";
  return "overnight";
}

export function getMarketStatusLabel(status: MarketStatus): string {
  const labels: Record<MarketStatus, string> = {
    trading: "국내장 거래 중",
    closed: "국내장 마감",
    overnight: "야간 참고가격",
    weekend: "주말 참고가격",
    "holiday-unknown": "국내 휴장",
    "data-stale": "데이터 지연",
    "baseline-needed": "기준가격 갱신 필요",
  };
  return labels[status];
}

/** UTC milliseconds for the 15:30 KST close on the given Seoul calendar date. */
function seoulDateToCloseUtcMs(year: number, month: number, day: number): number {
  // Korea Standard Time is UTC+9 year-round (no DST).
  // 15:30 KST = (KRX_CLOSE_HOUR - 9)h KRX_CLOSE_MINUTE UTC = 06:30 UTC.
  return Date.UTC(year, month - 1, day, KRX_CLOSE_HOUR - 9, KRX_CLOSE_MINUTE);
}

/**
 * Returns the UTC timestamp (ms) of the most recent KRX market close
 * (Mon–Fri 15:30 KST = 06:30 UTC). Does not account for Korean public holidays.
 *
 * Logic:
 * - If today (KST) is a weekday AND current time is at or past 15:30 → today's close.
 * - Otherwise walk back day-by-day (max 7) to the last Mon–Fri.
 *
 * Examples (now = 2026-08-09 Sunday KST):
 *   getLastKrxCloseMs() → 2026-08-07T06:30:00.000Z  (Friday close)
 */
export function getLastKrxCloseMs(now: Date = new Date()): number {
  const seoul = getSeoulDate(now);

  const isPastClose =
    seoul.hour * 60 + seoul.minute >= KRX_CLOSE_HOUR * 60 + KRX_CLOSE_MINUTE;

  // Weekday and already past today's close → today is the anchor
  if (seoul.dayOfWeek >= 1 && seoul.dayOfWeek <= 5 && isPastClose) {
    return seoulDateToCloseUtcMs(seoul.year, seoul.month, seoul.day);
  }

  // Walk back day-by-day (max 7 attempts covers any long weekend / holiday run)
  let probe = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (let i = 0; i < 7; i++) {
    const s = getSeoulDate(probe);
    if (s.dayOfWeek >= 1 && s.dayOfWeek <= 5) {
      return seoulDateToCloseUtcMs(s.year, s.month, s.day);
    }
    probe = new Date(probe.getTime() - 24 * 60 * 60 * 1000);
  }

  // Fallback – unreachable under normal calendar rules
  return seoulDateToCloseUtcMs(seoul.year, seoul.month, seoul.day - 3);
}
