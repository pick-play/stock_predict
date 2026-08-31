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
  fetchBookQuotes: vi.fn(),
  fetchMarkPriceAtTime: vi.fn(async () => 100),
}));

vi.mock("../../lib/binance/websocketAdapter", () => ({
  connectBinanceFuturesStream: binance.connectBinanceFuturesStream,
}));

vi.mock("../../lib/binance/client", () => ({
  fetchStockQuote: binance.fetchStockQuote,
  fetchBookQuotes: binance.fetchBookQuotes,
}));

vi.mock("../../lib/binance/klinesClient", () => ({
  fetchMarkPriceAtTime: binance.fetchMarkPriceAtTime,
}));

// No baseline by default — the feed-mode tests are not about the anchor. The
// resilience tests below swap in a real one to prove what a later failure of
// this fetch must NOT do to cards it already priced.
const github = vi.hoisted(() => ({
  fetchGithubBaseline: vi.fn(async (): Promise<unknown> => null),
  fetchGithubLatest: vi.fn(async () => null),
  fetchGithubHistory: vi.fn(async () => []),
}));

vi.mock("../../lib/githubFallback", () => github);

const { useMarketData } = await import("../useMarketData");
const { STOCK_IDS, MARKET_SYMBOLS } = await import("../../config/symbols");

/** Pretend the primary input is (or is not) a finger. */
function setTouchDevice(coarse: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("coarse") ? coarse : !coarse,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function bookQuote(
  symbol: string,
  eventTime = new Date().toISOString(),
  bid = 99.9,
  ask = 100.1
) {
  return {
    symbol,
    lastPrice: null,
    markPrice: null,
    indexPrice: null,
    bidPrice: bid,
    askPrice: ask,
    volume24h: null,
    changePercent24h: null,
    fundingRate: null,
    eventTime,
    source: "binance-rest" as const,
  };
}

function quoteFor(stockId: string) {
  const symbol = MARKET_SYMBOLS[stockId as keyof typeof MARKET_SYMBOLS]
    .binanceSymbol;
  return {
    stockId,
    quote: {
      ...bookQuote(symbol),
      lastPrice: 100,
      markPrice: 100,
    },
    referencePrice: 100,
    error: null,
  };
}

/**
 * Every configured stock, delivered the way the batched poll delivers them.
 *
 * The default bid/ask differ from `quoteFor`'s so that the 1s flush actually
 * commits the polled quote. With identical prices the flush short-circuits on
 * "nothing changed" and any assertion about what it writes passes vacuously.
 */
function allBookQuotes(eventTime?: string, bid = 99.8, ask = 100.2) {
  const quotes: Record<string, ReturnType<typeof bookQuote>> = {};
  for (const id of STOCK_IDS) {
    quotes[id] = bookQuote(MARKET_SYMBOLS[id].binanceSymbol, eventTime, bid, ask);
  }
  return { quotes, error: null };
}

describe("useMarketData feed mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    binance.fetchStockQuote.mockImplementation(async (id: string) =>
      quoteFor(id)
    );
    binance.fetchBookQuotes.mockImplementation(async () => allBookQuotes());
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

    await waitFor(() => expect(binance.fetchBookQuotes).toHaveBeenCalled());
    expect(binance.connectBinanceFuturesStream).not.toHaveBeenCalled();
  });

  it("polls on the configured interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);
    renderHook(() => useMarketData());

    await vi.waitFor(() => expect(binance.fetchBookQuotes).toHaveBeenCalled());
    const afterMount = binance.fetchBookQuotes.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(MOBILE_QUOTE_POLL_INTERVAL_MS);
    });

    expect(binance.fetchBookQuotes.mock.calls.length).toBeGreaterThan(afterMount);
  });

  /*
   * The poll reads every listing in one call. Asserting "once" rather than
   * "at least once" is deliberate: the failure this guards against is a future
   * edit that loops the per-symbol call, which would still pass every
   * correctness test while quietly multiplying the request rate by the number of
   * stocks — 21 requests every four seconds at seven listings.
   */
  it("issues one read per poll, not one per stock", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);
    renderHook(() => useMarketData());

    await vi.waitFor(() => expect(binance.fetchBookQuotes).toHaveBeenCalled());
    binance.fetchBookQuotes.mockClear();
    binance.fetchStockQuote.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(MOBILE_QUOTE_POLL_INTERVAL_MS);
    });

    expect(binance.fetchBookQuotes).toHaveBeenCalledTimes(1);
    // And that one call carries the whole listing, so the count above is not
    // cheap only because stocks are being dropped.
    const asked = binance.fetchBookQuotes.mock.calls[0]![0] as string[];
    expect([...asked].sort()).toEqual([...STOCK_IDS].sort());
    // The three-request-per-stock path stays out of the poll entirely.
    expect(binance.fetchStockQuote).not.toHaveBeenCalled();
  });

  // Every request wakes the radio; a tab nobody is looking at has nothing to
  // show for it.
  it("stops polling while the tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);
    renderHook(() => useMarketData());
    await vi.waitFor(() => expect(binance.fetchBookQuotes).toHaveBeenCalled());

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    const beforeHidden = binance.fetchBookQuotes.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(MOBILE_QUOTE_POLL_INTERVAL_MS * 3);
    });

    expect(binance.fetchBookQuotes.mock.calls.length).toBe(beforeHidden);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  // A batched read fails all at once. It must degrade the way the per-symbol one
  // did: say the feed is down, keep the last prices, never blank a card.
  it("reports the feed down when the batched read fails", async () => {
    setTouchDevice(true);
    binance.fetchBookQuotes.mockImplementation(async () => ({
      quotes: {},
      error: "HTTP 503",
    }));

    const { result } = renderHook(() => useMarketData());

    await waitFor(() => expect(result.current.wsStatus).toBe("disconnected"));
  });
});

/**
 * Freshness has to come from something that ticks.
 *
 * Measured on the live feed: NAVERUSDT's bookTicker timestamp was 9.8 minutes
 * old and did not advance across a 46-second sample, and HANMIUSDT's moved
 * backwards between consecutive reads. Those books are quiet — 0.07 and 0.18
 * frames a second — not broken, and their prices were valid throughout. Dating
 * a card from that timestamp would park the two quietest listings in 지연 and
 * then 업데이트 중단 all night over perfectly good numbers, which is the fastest
 * way to teach a reader that the staleness indicator means nothing.
 *
 * The mark price does keep ticking (426–1322 ms old on those same symbols while
 * their books sat frozen), and the minute refresh already dates its quotes from
 * premiumIndex.time. So eventTime only ever moves forward.
 */
describe("useMarketData quote freshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    binance.fetchStockQuote.mockImplementation(async (id: string) =>
      quoteFor(id)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /**
   * The flush only writes when the book has moved, and the minute refresh has
   * already merged the most recent polled bid/ask into the snapshot. So a test
   * that serves one unchanging book never reaches the timestamp code at all and
   * passes whatever the code does. Every case below moves the book on each poll
   * and then runs a poll and a flush, which is the only way to observe what the
   * flush writes.
   */
  function serveMovingBook(eventTime: () => string) {
    let bid = 99.8;
    binance.fetchBookQuotes.mockImplementation(async () => {
      bid += 0.01;
      return allBookQuotes(eventTime(), bid, bid + 0.4);
    });
  }

  async function pollAndFlush() {
    await act(async () => {
      vi.advanceTimersByTime(MOBILE_QUOTE_POLL_INTERVAL_MS);
    });
    await act(async () => {
      vi.advanceTimersByTime(1_500);
    });
  }

  it("does not let a frozen book age a card the mark price says is current", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);

    // NAVERUSDT's book, as measured: ten minutes old and not advancing.
    const frozen = new Date(Date.now() - 10 * 60_000).toISOString();
    serveMovingBook(() => frozen);

    const { result } = renderHook(() => useMarketData());
    await vi.waitFor(() => expect(result.current.stocks.samsung).toBeDefined());
    await pollAndFlush();

    const age =
      Date.now() - new Date(result.current.stocks.samsung!.eventTime).getTime();
    expect(age).toBeLessThan(60_000);
  });

  it("ignores a timestamp that moves backwards", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setTouchDevice(true);

    // Ahead of whatever the mark-price refresh stamped, so the flush is certain
    // to commit it and the rewind below has something to try to undo.
    const advanced = Date.now() + 5_000;
    let served = advanced;
    serveMovingBook(() => new Date(served).toISOString());

    const { result } = renderHook(() => useMarketData());
    await vi.waitFor(() => expect(result.current.stocks.samsung).toBeDefined());
    await pollAndFlush();

    // The flush really is writing book timestamps; the rewind assertion below
    // would be vacuous otherwise.
    expect(new Date(result.current.stocks.samsung!.eventTime).getTime()).toBe(
      advanced
    );

    // HANMIUSDT did exactly this between two consecutive reads.
    served = advanced - 35_000;
    await pollAndFlush();

    expect(new Date(result.current.stocks.samsung!.eventTime).getTime()).toBe(
      advanced
    );
  });
});

/**
 * A failed round must not erase what a good round produced.
 *
 * baseline.json is refetched every minute with cache:no-store, so a single
 * transient 502 used to send every card through the zeroing branch — seven
 * priced listings replaced by dashes over one dropped request. And a round
 * where every quote fetch failed kept the old numbers but stamped lastUpdated
 * as if they were new, which is §2.1's "stale data shown as current" verbatim.
 * These tests pin the keep-the-previous-value behaviour on both paths.
 */
describe("useMarketData resilience", () => {
  /** A baseline whose close anchor prices every listed stock. */
  function validBaseline() {
    return {
      schemaVersion: 2,
      timezone: "Asia/Seoul",
      updatedAt: new Date().toISOString(),
      referencePriceMode: "mark",
      open: null,
      close: {
        marketDate: "2026-08-28",
        anchorTimeUtc: new Date(Date.now() - 60 * 60_000).toISOString(),
        stocks: Object.fromEntries(
          STOCK_IDS.map((id) => [id, { krxPrice: 70_000 }])
        ),
      },
    };
  }

  /** The minute refresh re-runs on visibilitychange; cheaper than 60s of clock. */
  async function runNextRefresh() {
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setTouchDevice(false); // socket path: the mocked stream stays silent
    binance.fetchStockQuote.mockImplementation(async (id: string) =>
      quoteFor(id)
    );
    binance.fetchBookQuotes.mockImplementation(async () => allBookQuotes());
    binance.fetchMarkPriceAtTime.mockImplementation(async () => 100);
    github.fetchGithubBaseline.mockImplementation(async () => validBaseline());
  });

  afterEach(() => {
    // Implementations survive clearAllMocks; put the file's defaults back so
    // no other describe inherits a live baseline.
    github.fetchGithubBaseline.mockImplementation(async () => null);
    binance.fetchMarkPriceAtTime.mockImplementation(async () => 100);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps the last anchored numbers when baseline.json fails transiently", async () => {
    const { result } = renderHook(() => useMarketData());

    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("healthy")
    );
    const before = result.current.stocks.samsung!;
    expect(before.estimatedPrice).toBeGreaterThan(0);

    // One 502 from the static host on the next minute's refetch.
    github.fetchGithubBaseline.mockImplementation(async () => null);
    await runNextRefresh();

    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("stale")
    );
    const after = result.current.stocks.samsung!;
    expect(after.estimatedPrice).toBe(before.estimatedPrice);
    expect(after.krxClose).toBe(before.krxClose);
    expect(after.baselineBinancePrice).toBe(before.baselineBinancePrice);
  });

  it("keeps a card whose anchor kline read failed", async () => {
    const { result } = renderHook(() => useMarketData());
    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("healthy")
    );
    const before = result.current.stocks.samsung!;

    // The baseline is fine; only the futures-price-at-anchor read is down.
    binance.fetchMarkPriceAtTime.mockImplementation(async () => {
      throw new Error("HTTP 502");
    });
    await runNextRefresh();

    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("stale")
    );
    expect(result.current.stocks.samsung!.estimatedPrice).toBe(
      before.estimatedPrice
    );
  });

  it("zeroes out only a card that never had a good value", async () => {
    // No baseline from the start: the honest state really is "no estimate".
    github.fetchGithubBaseline.mockImplementation(async () => null);

    const { result } = renderHook(() => useMarketData());

    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("no-baseline")
    );
    expect(result.current.stocks.samsung!.estimatedPrice).toBe(0);
  });

  it("does not restamp lastUpdated when every quote fails", async () => {
    const { result } = renderHook(() => useMarketData());
    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("healthy")
    );
    const stamped = result.current.lastUpdated;
    expect(stamped).not.toBeNull();
    const price = result.current.stocks.samsung!.estimatedPrice;

    binance.fetchStockQuote.mockImplementation(async () => {
      throw new Error("HTTP 503");
    });
    await runNextRefresh();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // The prices on screen are last round's; the timestamp must say so.
    expect(result.current.lastUpdated).toBe(stamped);
    expect(result.current.stocks.samsung!.estimatedPrice).toBe(price);
  });

  it("still stamps lastUpdated when at least one listing refreshed", async () => {
    const { result } = renderHook(() => useMarketData());
    await waitFor(() =>
      expect(result.current.stocks.samsung?.status).toBe("healthy")
    );

    // A fully failed round raises the error…
    binance.fetchStockQuote.mockImplementation(async () => {
      throw new Error("HTTP 503");
    });
    await runNextRefresh();
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // …and one listing answering clears it again: a partial round is still a
    // real update (§18: one listing's failure must not take the page down).
    binance.fetchStockQuote.mockImplementation(async (id: string) => {
      if (id !== "samsung") throw new Error("HTTP 503");
      return quoteFor(id);
    });
    await runNextRefresh();

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.stocks.samsung?.status).toBe("healthy");
  });
});
