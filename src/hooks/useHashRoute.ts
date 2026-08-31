import { useState, useEffect, useCallback } from "react";

export type Route = "dashboard" | "board" | "chat" | "admin";

function parseHash(hash: string): Route {
  if (hash === "#board") return "board";
  if (hash === "#chat") return "chat";
  if (hash === "#admin") return "admin";
  return "dashboard";
}

function hashFor(route: Route): string {
  if (route === "board") return "#board";
  if (route === "chat") return "#chat";
  if (route === "admin") return "#admin";
  return "";
}

/**
 * Hash-based client-side routing — no react-router required.
 * "#board" → board view; "#chat" → chat room; "#admin" → moderator console
 * (password-gated, unlinked); anything else → dashboard.
 */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash)
  );

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Stable identity, so effects and memoized children taking `navigate` do
  // not re-run on every route change.
  const navigate = useCallback((r: Route) => {
    window.location.hash = hashFor(r);
    setRoute(r);
  }, []);

  return [route, navigate];
}
