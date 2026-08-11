/**
 * Supplies the US release calendar.
 *
 * A plain fetch of a committed file, refreshed hourly — the collector runs once a
 * day, so the interval only has to catch a tab left open across the update.
 */

import { useEffect, useState } from "react";
import type { EconomicCalendar } from "../types/economic";
import { fetchEconomicCalendar } from "../lib/economic/api";
import { ECONOMIC_REFRESH_INTERVAL_MS } from "../config/economic";

export interface EconomicCalendarState {
  calendar: EconomicCalendar | null;
  isLoading: boolean;
}

export function useEconomicCalendar(): EconomicCalendarState {
  const [state, setState] = useState<EconomicCalendarState>({
    calendar: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const next = await fetchEconomicCalendar(controller.signal);
      if (cancelled) return;
      // A failed refresh keeps the calendar already on screen; only the first
      // load can leave it null.
      setState((prev) => ({
        calendar: next ?? prev.calendar,
        isLoading: false,
      }));
    };

    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, ECONOMIC_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
