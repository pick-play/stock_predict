/**
 * Formatting for the US release calendar, all of it in Seoul time.
 *
 * The collector stores UTC instants, so every function here is a conversion for
 * display — never arithmetic on a date string, which is how "21:30" ends up an
 * hour wrong for half the year.
 */

const KST = "Asia/Seoul";

/** "08/12 21:30" — the shape used on the compact strip. */
export function formatReleaseWhen(releaseAtUtc: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(releaseAtUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

/** "8월 12일 (수) 21:30 KST" — for the expanded list and tooltips. */
export function formatReleaseWhenLong(releaseAtUtc: string): string {
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(releaseAtUtc));
  return `${formatted} KST`;
}

/**
 * "3일 뒤" / "2시간 뒤" / "잠시 뒤".
 *
 * Days are counted between Seoul calendar dates rather than by dividing a
 * duration, so a release tomorrow morning reads "내일" instead of "13시간 뒤".
 */
export function formatCountdown(
  releaseAtUtc: string,
  nowMs: number = Date.now()
): string {
  const target = new Date(releaseAtUtc).getTime();
  const diffMs = target - nowMs;
  if (!Number.isFinite(diffMs)) return "";
  if (diffMs <= 0) return "발표됨";

  const dayGap = seoulDayNumber(target) - seoulDayNumber(nowMs);
  if (dayGap >= 2) return `${dayGap}일 뒤`;
  if (dayGap === 1) return "내일";

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours}시간 뒤`;
  const minutes = Math.floor(diffMs / 60_000);
  return minutes >= 1 ? `${minutes}분 뒤` : "잠시 뒤";
}

/** Days since the epoch in Seoul, so two instants can be compared by date. */
function seoulDayNumber(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  const [y, m, d] = parts.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** True when the release falls on today's Seoul date. */
export function isToday(releaseAtUtc: string, nowMs: number = Date.now()): boolean {
  return seoulDayNumber(new Date(releaseAtUtc).getTime()) === seoulDayNumber(nowMs);
}
