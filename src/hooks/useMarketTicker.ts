/**
 * Feeds the ticker tape.
 *
 * Two sources with different honesty levels, merged into one list:
 *   - the Worker proxy, refreshed on a timer, delayed by its upstream
 *   - the browser's own Binance socket, genuinely live, crypto only
 *
 * The live socket wins for the instrument it covers, and that row is the only
 * one flagged isLive. Everything else carries its real age so the tape can say
 * 지연 instead of implying a tick.
 */

import { useEffect, useRef, useState } from "react";
import type { MarketQuote, TickerItem } from "../types/ticker";
import { fetchMarkets, isMarketsConfigured } from "../lib/markets/api";
import { connectBinanceSpotTicker } from "../lib/markets/binanceTicker";
import type { LiveTicker } from "../lib/markets/binanceTicker";
import {
  TICKER_INSTRUMENTS,
  TICKER_REFRESH_INTERVAL_MS,
  TICKER_STALE_THRESHOLD_MS,
} from "../config/tickerInstruments";

export interface MarketTickerState {
  items: TickerItem[];
  isLoading: boolean;
}

/** Instruments whose live value comes from the browser's own socket. */
const LIVE_INSTRUMENTS = TICKER_INSTRUMENTS.filter(
  (i) => i.source === "binance-ws" && i.binanceSymbol
);

function buildItems(
  quotes: Map<string, MarketQuote>,
  live: Map<string, LiveTicker>,
  nowMs: number
): TickerItem[] {
  const items: TickerItem[] = [];

  for (const instrument of TICKER_INSTRUMENTS) {
    const liveTicker = instrument.binanceSymbol
      ? live.get(instrument.binanceSymbol)
      : undefined;

    if (liveTicker) {
      items.push({
        id: instrument.id,
        label: instrument.label,
        price: liveTicker.price,
        changePercent: liveTicker.changePercent24h,
        decimals: instrument.decimals,
        unit: instrument.unit,
        status: "open",
        isStale: false,
        isLive: true,
      });
      continue;
    }

    const quote = quotes.get(instrument.id);
    if (!quote) continue;

    const ageMs = nowMs - new Date(quote.asOf).getTime();

    items.push({
      id: instrument.id,
      label: instrument.label,
      price: quote.price,
      changePercent: quote.changePercent,
      decimals: instrument.decimals,
      unit: instrument.unit,
      status: quote.status,
      // A closed market's last print is old by definition; that is what the
      // 장 마감 badge already says, so flagging it 지연 as well would be noise.
      isStale:
        quote.status !== "closed" &&
        Number.isFinite(ageMs) &&
        ageMs > TICKER_STALE_THRESHOLD_MS,
      isLive: false,
    });
  }

  return items;
}

export function useMarketTicker(): MarketTickerState {
  const [state, setState] = useState<MarketTickerState>({
    items: [],
    isLoading: isMarketsConfigured,
  });

  const quotesRef = useRef<Map<string, MarketQuote>>(new Map());
  const liveRef = useRef<Map<string, LiveTicker>>(new Map());

  // Poll the proxy.
  useEffect(() => {
    if (!isMarketsConfigured) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();

      const data = await fetchMarkets(controller.signal);
      if (cancelled || !data) {
        // Keep whatever is already on the tape; a failed refresh should not
        // blank a row that was correct a moment ago.
        if (!cancelled) setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      quotesRef.current = new Map(data.quotes.map((q) => [q.id, q]));
      setState({
        items: buildItems(quotesRef.current, liveRef.current, Date.now()),
        isLoading: false,
      });
    };

    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, TICKER_REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Hold the live socket open and fold its ticks in.
  useEffect(() => {
    if (LIVE_INSTRUMENTS.length === 0) return;

    const symbols = LIVE_INSTRUMENTS.map((i) => i.binanceSymbol!);

    const disconnect = connectBinanceSpotTicker(symbols, (ticker) => {
      // Written to a ref only. The stream emits about once a second per symbol;
      // the flush timer below turns that into one render per second at most.
      liveRef.current.set(ticker.symbol, ticker);
    });

    const flush = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (liveRef.current.size === 0) return;

      setState((prev) => {
        const items = buildItems(
          quotesRef.current,
          liveRef.current,
          Date.now()
        );
        // Cheap identity check: a tape row only ever changes price or badge, so
        // comparing the rendered numbers is enough to skip a no-op render.
        const unchanged =
          prev.items.length === items.length &&
          prev.items.every((item, i) => {
            const next = items[i];
            return (
              item.id === next.id &&
              item.price === next.price &&
              item.changePercent === next.changePercent &&
              item.status === next.status &&
              item.isStale === next.isStale
            );
          });

        if (unchanged) return prev;
        return { items, isLoading: false };
      });
    }, 1000);

    return () => {
      disconnect();
      window.clearInterval(flush);
    };
  }, []);

  return state;
}
