/**
 * Chat timestamps are rendered as HH:mm KST rather than reusing
 * formatKoreanTime(): a chat line is read in sequence, so seconds are noise,
 * and hundreds of them stacked in a column need the narrowest stable width.
 * The exact instant stays available in the element's title attribute.
 */

const KST_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatChatTime(isoString: string): string {
  const at = new Date(isoString);
  // A malformed timestamp must not put "Invalid Date" in the transcript.
  if (Number.isNaN(at.getTime())) return "--:--";
  return KST_TIME.format(at);
}
