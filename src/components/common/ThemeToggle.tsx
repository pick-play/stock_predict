import { useTheme } from "../../hooks/useTheme";

/**
 * Switches between the light and dark palettes.
 *
 * The icon shows the theme the button will switch *to*, which is what a reader
 * scanning a header expects from a single-button switch.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const goingTo = theme === "dark" ? "라이트" : "다크";

  return (
    <button
      type="button"
      onClick={toggle}
      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
      aria-label={`${goingTo} 모드로 전환`}
      title={`${goingTo} 모드`}
    >
      {theme === "dark" ? (
        // Sun — clicking moves to the light palette
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // Moon — clicking moves to the dark palette
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
