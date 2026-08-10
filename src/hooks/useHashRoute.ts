import { useState, useEffect } from "react";

export type Route = "dashboard" | "board" | "chat";

function parseHash(hash: string): Route {
  if (hash === "#board") return "board";
  if (hash === "#chat") return "chat";
  return "dashboard";
}

function hashFor(route: Route): string {
  if (route === "board") return "#board";
  if (route === "chat") return "#chat";
  return "";
}

/**
 * Hash-based client-side routing — no react-router required.
 * "#board" → board view; "#chat" → chat room; anything else → dashboard.
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

  const navigate = (r: Route) => {
    window.location.hash = hashFor(r);
    setRoute(r);
  };

  return [route, navigate];
}
