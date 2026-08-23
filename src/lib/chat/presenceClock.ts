/**
 * When this tab last told the server it was here.
 *
 * Presence can be announced two ways — as its own tiny POST, or as a flag on
 * the chat preview poll the dashboard is already making — and the point of
 * having both is that neither page pays for a request it does not need. This is
 * the shared clock that keeps them from both firing.
 *
 * On the dashboard the preview carries it, and the standalone ping finds
 * nothing due. On the board, where no preview runs, the ping does the work. The
 * server sees one announcement a minute either way.
 *
 * Module state rather than a hook, because the two callers are a hook and a
 * fetch helper in different subtrees, and this is one number.
 */

let lastSentAtMs = 0;

/** True when the interval has elapsed since the last announcement. */
export function isPresenceDue(intervalMs: number, nowMs = Date.now()): boolean {
  return nowMs - lastSentAtMs >= intervalMs;
}

export function notePresenceSent(nowMs = Date.now()): void {
  lastSentAtMs = nowMs;
}

/** Test seam: one file's clock must not decide the next file's behaviour. */
export function resetPresenceClock(): void {
  lastSentAtMs = 0;
}
