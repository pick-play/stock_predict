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

  return {
    year: parseInt(get("year")),
    month: parseInt(get("month")),
    day: parseInt(get("day")),
    hour: parseInt(get("hour")),
    minute: parseInt(get("minute")),
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
  };
}

export function isWeekend(date: Date = new Date()): boolean {
  const { dayOfWeek } = getSeoulDate(date);
  return dayOfWeek === 0 || dayOfWeek === 6;
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
