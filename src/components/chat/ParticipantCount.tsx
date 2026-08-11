/**
 * Live participant count.
 *
 * The number comes from the room's socket set, so it is the count of open
 * connections, not of people — one visitor with two tabs counts twice. The label
 * says "접속" rather than "명" alone to avoid overstating what it measures.
 *
 * State is never colour-only (§19): the dot is paired with the word "실시간" or
 * "대기", so the meaning survives without colour perception.
 */

interface ParticipantCountProps {
  participants: number;
  isLive: boolean;
}

export function ParticipantCount({
  participants,
  isLive,
}: ParticipantCountProps) {
  const label = isLive
    ? `현재 ${participants}명 접속 중`
    : "접속자 수 확인 중";

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
      style={{
        borderColor: isLive
          ? "rgba(49,196,141,0.28)"
          : "var(--border-subtle)",
        background: isLive ? "rgba(49,196,141,0.07)" : "transparent",
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: isLive ? "#31c48d" : "var(--text-muted)" }}
        aria-hidden="true"
      />
      <span
        className="text-xs font-medium tabular-nums"
        style={{ color: isLive ? "#31c48d" : "var(--text-muted)" }}
      >
        {isLive ? `${participants}명` : "—"}
      </span>
      <span className="text-[12px] text-[var(--text-muted)]">
        {isLive ? "실시간" : "대기"}
      </span>
    </div>
  );
}
