import { useState, useEffect, useRef } from "react";
import type { HistoryEntry, StockId } from "../types/market";
import type { ChartRange, StockAnchor } from "../lib/binance/klineHistory";
import { fetchKlineHistory } from "../lib/binance/klineHistory";
import { fetchGithubHistory } from "../lib/githubFallback";
import { HISTORY_REFRESH_INTERVAL_MS } from "../config/market";

export interface ChartHistoryState {
  history: HistoryEntry[];
  isLoading: boolean;
  /** True while showing the stored snapshot because live candles were unreachable. */
  usingStoredHistory: boolean;
}

/**
 * Supplies the chart series for the selected range.
 *
 * Candles come from the reader's own connection because the scheduled
 * collector cannot reach the futures API. If that fails too — offline, or a
 * region that blocks it — the committed history.json still renders something
 * rather than an empty chart.
 */
export function useChartHistory(
  range: ChartRange,
  anchors: Partial<Record<StockId, StockAnchor>>
): ChartHistoryState {
  const [state, setState] = useState<ChartHistoryState>({
    history: [],
    isLoading: true,
    usingStoredHistory: false,
  });

  // Anchors arrive as a fresh object every render; compare by value so the
  // effect re-runs when the numbers change, not on every parent render.
  const anchorKey = JSON.stringify(anchors);
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      const live = await fetchKlineHistory(
        range,
        anchorsRef.current,
        controller.signal
      );
      if (cancelled) return;

      if (live && live.length > 0) {
        setState({ history: live, isLoading: false, usingStoredHistory: false });
        return;
      }

      const stored = await fetchGithubHistory();
      if (cancelled) return;
      setState({
        history: stored ?? [],
        isLoading: false,
        usingStoredHistory: stored !== null && stored.length > 0,
      });
    };

    setState((prev) => ({ ...prev, isLoading: true }));
    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, HISTORY_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [range, anchorKey]);

  return state;
}
