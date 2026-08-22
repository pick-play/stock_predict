import { useEffect, useState } from "react";

/**
 * Whether a CSS media query currently matches, kept in sync as it changes.
 *
 * For the handful of decisions that cannot be made in CSS — a component that
 * renders something structurally different rather than styling one thing two
 * ways. Anything achievable with a Tailwind breakpoint should stay in the
 * class list; this is for branches in behaviour.
 *
 * Starts false where there is no window (tests, any SSR), so callers get the
 * conservative branch rather than a crash.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
