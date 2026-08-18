/**
 * The site's control shapes, in one place.
 *
 * Written after making the header buttons look better made everything near them
 * look worse. The cause was not that the new buttons were too loud: it was that
 * the older controls — 공감, 신고, 취소 — had no shape at all. They were bare
 * 12px text, which reads as unstyled the moment anything beside it has a form.
 *
 * So there are three levels, and they share a geometry rather than a weight:
 *
 *   PILL_PRIMARY  the one action a screen wants (글 등록, 공유하기)
 *   PILL_SURFACE  navigation and account controls — visible at rest
 *   PILL_QUIET    actions inside a card — invisible at rest, shaped on contact
 *
 * A feed of short posts must not carry a filled button on every row, which is
 * why the quiet level exists: same rounded-full, same press, no weight until a
 * finger or a cursor arrives.
 */

/** Shape, focus ring and press feedback — shared by all three. */
const PILL_BASE = [
  "inline-flex items-center justify-center gap-1.5 rounded-full",
  "font-medium transition-colors duration-150",
  "active:scale-[0.97] motion-reduce:active:scale-100",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]",
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
].join(" ");

export const PILL_SURFACE = [
  PILL_BASE,
  "h-9 px-3 text-[13px]",
  "border border-[var(--border-subtle)] bg-[var(--surface-2)]",
  "text-[var(--text-secondary)]",
  "hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]",
].join(" ");

/**
 * In-card actions.
 *
 * `min-h-[44px]` with a negative margin: the touch target stays the 44px §19
 * asks for while the visible pill only occupies the row it sits in. At rest
 * there is no border and no fill, so a row of these reads as text — which is
 * what a feed wants — and the shape appears under the pointer.
 */
export const PILL_QUIET = [
  PILL_BASE,
  "min-h-[44px] -my-2 px-2.5 text-[12px]",
  "text-[var(--text-muted)]",
  "hover:bg-[var(--surface-3)] hover:text-[var(--text-secondary)]",
].join(" ");

/** Destructive variant of the quiet level: 신고 확인, and nothing else. */
export const PILL_QUIET_DANGER = [
  PILL_BASE,
  "min-h-[44px] -my-2 px-2.5 text-[12px]",
  "text-[#ff5d6c]",
  "hover:bg-[rgba(255,93,108,0.10)]",
  "focus-visible:ring-[#ff5d6c]",
].join(" ");

/**
 * The single most important action on a screen. The gradient is the only place
 * the brand violet appears as a fill, which is what keeps it meaning "this one".
 */
export const PILL_PRIMARY = [
  PILL_BASE,
  "h-9 px-4 text-[13px] font-semibold text-white",
].join(" ");

/** Inline style for PILL_PRIMARY — a gradient Tailwind would need config for. */
export const PILL_PRIMARY_STYLE = {
  background: "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)",
} as const;
