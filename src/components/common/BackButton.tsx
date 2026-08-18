/**
 * "← 시세" — the way back to the dashboard from a subpage.
 *
 * It replaces a 32px bordered square holding a bare arrow. That was hard to aim
 * at on a phone, sat below the 44px touch target the rest of the site keeps to,
 * and said nothing about where it went: an arrow alone is a direction, not a
 * destination. The label is the fix, and it costs one word.
 */

import { PILL_SURFACE } from "./controls";

interface BackButtonProps {
  onClick: () => void;
  /** Where the reader lands. Shown next to the arrow. */
  label?: string;
}

export function BackButton({ onClick, label = "시세" }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} 화면으로 돌아가기`}
      className={`group shrink-0 ${PILL_SURFACE} gap-1 pl-2 pr-3`}
    >
      {/* The arrow slides back a touch on hover — the direction, felt. */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="transition-transform duration-150 group-hover:-translate-x-0.5 motion-reduce:transform-none"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {label}
    </button>
  );
}
