import { useEffect } from "react";
import { CLIENT_REFRESH_INTERVAL_MS } from "../config/market";

export function useMinuteRefresh(callback: () => void | Promise<void>) {
  useEffect(() => {
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        await callback();
      } finally {
        running = false;
      }
    };

    void run();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void run();
      }
    }, CLIENT_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void run();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
