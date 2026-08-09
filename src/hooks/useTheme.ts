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
    meta.setAttribute("content", theme === "light" ? "#f6f8fb" : "#080b10");
  }
}

export interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme>(
    () => storedTheme() ?? systemTheme()
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS while the reader has not chosen for themselves.
  useEffect(() => {
    if (storedTheme() !== null) return;
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!query) return;

    const onChange = () => setTheme(systemTheme());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode — the choice still holds for this session.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
