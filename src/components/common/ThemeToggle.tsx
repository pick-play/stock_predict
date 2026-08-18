import { useTheme } from "../../hooks/useTheme";

/**
 * Switches between the light and dark palettes.
 *
 * Built as a physical-feeling switch rather than a flat icon button: a raised
 * knob that slides across a recessed track, drops on press and springs back.
 * The track carries both icons, so the current state is visible at rest instead
 * of having to be inferred from an icon that means "what happens if you press".
 *
 * The motion is a transform and a shadow only — both compositor work, no layout
 * — and `prefers-reduced-motion` removes it while leaving the switch usable.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const goingTo = isDark ? "라이트" : "다크";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggle}
      aria-label={`${goingTo} 모드로 전환`}
      title={`${goingTo} 모드`}
      className="theme-switch"
    >
      {/* Both icons sit on the track; the knob covers the active one. */}
      <span className="theme-switch__icons" aria-hidden="true">
        <SunIcon />
        <MoonIcon />
      </span>

      <span
        className="theme-switch__knob"
        aria-hidden="true"
        data-state={isDark ? "dark" : "light"}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
