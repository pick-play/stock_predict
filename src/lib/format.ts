import type { Direction } from "../types/market";

export function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value)}원`;
}

export function formatPercent(value: number): string {
  const percent = value * 100;
  if (percent === 0) return "0.00%";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

export function formatChangeAmount(value: number): string {
  if (value === 0) return "0원";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function formatDirectionSymbol(value: number): string {
  if (value > 0) return "▲";
  if (value < 0) return "▼";
  return "―";
}

export function getDirection(value: number): Direction {
  if (value > 0) return "rise";
  if (value < 0) return "fall";
  return "neutral";
}

export function formatKoreanTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const seoulFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const seoulNowParts = seoulFormatter.formatToParts(now);
  const seoulDateParts = seoulFormatter.formatToParts(date);

  const getVal = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const nowDay = getVal(seoulNowParts, "day");
  const dateDay = getVal(seoulDateParts, "day");
  const nowMonth = getVal(seoulNowParts, "month");
  const dateMonth = getVal(seoulDateParts, "month");
  const nowYear = getVal(seoulNowParts, "year");
  const dateYear = getVal(seoulDateParts, "year");

  const timeStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  if (nowDay === dateDay && nowMonth === dateMonth && nowYear === dateYear) {
    return timeStr;
  }

  return `${dateMonth}월 ${dateDay}일 ${timeStr}`;
}

export function formatKoreanTimeDetailed(isoString: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(isoString)) + " KST";
}

export function formatRelativeTime(isoString: string, now?: Date): string {
  /*
   * Clamped at zero, which is what stops "-1초 전" appearing.
   *
   * The event can legitimately be stamped later than `now`: the readout takes a
   * snapshot of a clock that ticks once a second, while the price socket stamps
   * a new quote about a hundred times a second. A quote from 1.4s sitting next
   * to a clock still reading 1.0s is 400ms in the future, and
   * Math.floor(-0.4) is -1. Nothing is wrong with either value — they are just
   * read at different rates — so the answer is 0초 전, not a negative age.
   */
  const rawDiff = (now ?? new Date()).getTime() - new Date(isoString).getTime();
  const diff = Math.max(0, rawDiff);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 전`;
}

export function formatBinancePrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}
