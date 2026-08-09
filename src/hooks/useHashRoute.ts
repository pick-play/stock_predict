import { useState, useEffect } from "react";

export type Route = "dashboard" | "board";

function parseHash(hash: string): Route {
  return hash === "#board" ? "board" : "dashboard";
}

/**
 * Hash-based client-side routing — no react-router required.
 * "#board" → board view; anything else → dashboard.
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
    window.location.hash = r === "board" ? "#board" : "";
    setRoute(r);
  };

  return [route, navigate];
}
