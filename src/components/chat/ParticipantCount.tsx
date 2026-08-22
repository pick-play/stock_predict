/**
 * How many people are on the site.
 *
 * Site-wide as of 2026-08-22 (owner decision), not the room's socket count: most
 * readers never open the chat, so a room reporting its own sockets described how
 * empty the room was rather than how busy the site is.
 *
 * Still not a headcount. The server counts distinct IP hashes, so a household or
 * an office behind one address is one — the label says 접속 rather than claiming
 * people, and the room's own §28.3 caution about not overstating this holds.
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
    ? `사이트 접속 ${participants}명`
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
