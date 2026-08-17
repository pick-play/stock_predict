/**
 * A phone must not hold the price socket open.
 *
 * Measured before this split: the bookTicker stream for these two symbols
 * delivers 103.8 frames a second — 653 KB per 30 seconds, ~78 MB an hour, about
 * a hundred JSON parses a second. Rendering was already batched to 1s, but the
 * receiving is not, and a modem fed that many packets never idles. The page was
 * warm to hold. There is no slower stream to move to: markPrice, ticker and
 * aggTrade were all probed and emit nothing for TradFi symbols.
 *
 * So the device decides the delivery, and these tests pin that decision.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MOBILE_QUOTE_POLL_INTERVAL_MS } from "../../config/market";

const binance = vi.hoisted(() => ({
  connectBinanceFuturesStream: vi.fn(() => () => {}),
  fetchStockQuote: vi.fn(),
  fetchMarkPriceAtTime: vi.fn(async () => 100),
}));

vi.mock("../../lib/binance/websocketAdapter", () => ({
  connectBinanceFuturesStream: binance.connectBinanceFuturesStream,
}));

vi.mock("../../lib/binance/client", () => ({
  fetchStockQuote: binance.fetchStockQuote,
}));

vi.mock("../../lib/binance/klinesClient", () => ({
  fetchMarkPriceAtTime: binance.fetchMarkPriceAtTime,
}));

// The baseline fetch is not what this file is about.
vi.mock("../../lib/githubFallback", () => ({
  fetchGithubBaseline: async () => null,
  fetchGithubLatest: async () => null,
  fetchGithubHistory: async () => [],
}));

const { useMarketData } = await import("../useMarketData");

/** Pretend the primary input is (or is not) a finger. */
function setTouchDevice(coarse: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("coarse") ? coarse : !coarse,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function quoteFor(symbol: string) {
  return {
    stockId: symbol === "SAMSUNGUSDT" ? "samsung" : "skHynix",
    quote: {
      symbol,
      lastPrice: 100,
      markPrice: 100,
      indexPrice: null,
      bidPrice: 99.9,
      askPrice: 100.1,
      volume24h: null,
      changePercent24h: null,
      fundingRate: null,
      eventTime: new Date().toISOString(),
      source: "binance-rest" as const,
    },
    referencePrice: 100,
    error: null,
  };
}

describe("useMarketData feed mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    binance.fetchStockQuote.mockImplementation(async (id: string) =>
      quoteFor(id === "samsung" ? "SAMSUNGUSDT" : "SKHYNIXUSDT")
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("streams on a pointer device", async () => {
    setTouchDevice(false);
    renderHook(() => useMarketData());

    await waitFor(() =>
      expect(binance.connectBinanceFuturesStream).toHaveBeenCalledOnce()
    );
  });

  it("opens no socket at all on a touch device", async () => {
    setTouchDevice(true);
    renderHook(() => useMarketData());

    await waitFor(() => expect(binance.fetchStockQuote).toHaveBeenCalled());
    expect(binance.connectBinanceFuturesStream).not.toHaveBeenCalled();
  });

  it("polls on the configured interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);
    renderHook(() => useMarketData());

    // One immediate read on mount, per stock.
    await vi.waitFor(() => expect(binance.fetchStockQuote).toHaveBeenCalled());
    const afterMount = binance.fetchStockQuote.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(MOBILE_QUOTE_POLL_INTERVAL_MS);
    });

    expect(binance.fetchStockQuote.mock.calls.length).toBeGreaterThan(afterMount);
  });

  // Every request wakes the radio; a tab nobody is looking at has nothing to
  // show for it.
  it("stops polling while the tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);
    renderHook(() => useMarketData());
    await vi.waitFor(() => expect(binance.fetchStockQuote).toHaveBeenCalled());

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    const beforeHidden = binance.fetchStockQuote.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(MOBILE_QUOTE_POLL_INTERVAL_MS * 3);
    });

    expect(binance.fetchStockQuote.mock.calls.length).toBe(beforeHidden);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });
});
