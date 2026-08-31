import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "kospinow:theme";

/** What the OS asks for, used until the reader states a preference of their own. */
function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function storedTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Apply the theme to the document.
 *
 * The stylesheet already carries both palettes: `prefers-color-scheme` for the
 * untouched case and `[data-theme]` for an explicit choice. Setting the
 * attribute is therefore all the switch has to do — and it must win over the
 * media query, which it does by specificity.
 */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  // Keep the mobile browser chrome in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    // The light value matches --bg in index.css, so the browser chrome and the
    // page behind it are the same colour.
    meta.setAttribute("content", theme === "light" ? "#f0f4f8" : "#080b10");
  }
}

export interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export function useTheme(): ThemeState {
  /**
   * The device setting, and an override only when the reader has asked for
   * something else.
   *
   * Held apart so the OS stays authoritative. Collapsing them into one value
   * meant the first toggle wrote a preference that outlived any reason for it:
   * the site then ignored the phone switching to light for good, with no way
   * back short of clearing site data.
   */
  const [override, setOverride] = useState<Theme | null>(() => storedTheme());
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme = override ?? system;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Subscribed unconditionally: the reader may drop their override later, and an
  // effect that skipped subscribing while one existed would not notice.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!query) return;

    const onChange = () => setSystem(systemTheme());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setOverride(() => {
      const next: Theme = theme === "dark" ? "light" : "dark";

      /*
       * Choosing whatever the device already asks for clears the override rather
       * than pinning it. Two taps therefore return the site to following the OS,
       * which is the only way back that does not need a settings screen.
       */
      if (next === systemTheme()) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Private mode — nothing was stored to remove.
        }
        return null;
      }

      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode — the choice still holds for this session.
      }
      return next;
    });
  }, [theme]);

  return { theme, toggle };
}
