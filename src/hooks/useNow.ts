import { useState, useEffect } from "react";

const TICK_INTERVAL_MS = 1_000;

/**
 * Returns the current Date, re-rendering once per second while the page is
 * visible. Pauses the interval when the document is hidden and resumes
 * (with an immediate tick) when it becomes visible again, so stale relative
 * time labels refresh as soon as the user returns to the tab.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number | undefined;

    const tick = () => setNow(new Date());

    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(tick, TICK_INTERVAL_MS);
    };

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick(); // immediate refresh on restore
        start();
      } else {
        stop();
      }
    };

    // Start ticking immediately if already visible
    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return now;
}
