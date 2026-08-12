/**
 * Chat timestamps.
 *
 * The first hour is relative — "방금", then "3분 전" — because that is the window
 * a reader is actually placing a line in ("did this just arrive, or was it here
 * before I looked?"). A clock time answers that question only after arithmetic.
 *
 * Past an hour the relative form stops helping and starts hiding: "58분 전" and
 * "2시간 전" both mean "earlier", while 11:05 places the line in the day. So the
 * older lines fall back to HH:mm KST — no seconds, since a transcript is read in
 * sequence and hundreds of them in a column need the narrowest stable width.
 * The exact instant stays available in the element's title attribute.
 */

const KST_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export function formatChatTime(isoString: string, now: Date = new Date()): string {
  const at = new Date(isoString);
  // A malformed timestamp must not put "Invalid Date" in the transcript.
  if (Number.isNaN(at.getTime())) return "--:--";

  const elapsed = now.getTime() - at.getTime();

  /*
   * Negative elapsed means the sender's clock ran ahead of this reader's. It is
   * the server's timestamp, so the line really did just arrive; "-2분 전" would
   * be nonsense and a clock time would look like a message from the future.
   */
  if (elapsed < MINUTE_MS) return "방금";

  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)}분 전`;
  }

  return KST_TIME.format(at);
}
