/**
 * The wiring, end to end: feed → provider → context → badge.
 *
 * Twice now the badge kept saying 국내장 거래 중 on a holiday after the logic
 * had been fixed, because the market data never reached it. First the Worker's
 * CORS dropped the response on localhost; then an empty API base in dev turned
 * the feed off entirely. Both times every unit test passed — they mocked the
 * context the real app was failing to fill.
 *
 * So this one mocks nothing but the network boundary.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { MarketsResponse } from "../../../types/ticker";

/** Trimmed copy of a real GET /api/markets body from the 2026-08-17 holiday. */
const HOLIDAY_FEED: MarketsResponse = {
  generatedAt: "2026-08-17T05:54:17.258Z",
  quotes: [
    {
      id: "kospi",
      price: 3298.35,
      previousClose: 3290.1,
      changePercent: 0.25,
      asOf: "2026-08-14T06:00:00.000Z",
      status: "closed",
      sessionStart: "2026-08-14T00:00:00.000Z",
      sessionEnd: "2026-08-14T06:00:00.000Z",
    },
  ],
};

const api = vi.hoisted(() => ({
  fetchMarkets: vi.fn(),
  isMarketsConfigured: true,
}));

vi.mock("../../../lib/markets/api", () => api);

// The tape also opens a Binance socket for crypto; irrelevant here.
vi.mock("../../../lib/markets/binanceTicker", () => ({
  connectBinanceSpotTicker: () => () => {},
}));

const { MarketDataProvider } = await import("../MarketDataProvider");
const { MarketStatusBadge } = await import("../MarketStatusBadge");

/** Monday 2026-08-17 14:54 KST — inside the hours, and a substitute holiday. */
const HOLIDAY_AFTERNOON = new Date("2026-08-17T05:54:00.000Z");

describe("MarketStatusBadge, fed by the real provider", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOLIDAY_AFTERNOON);
    api.fetchMarkets.mockResolvedValue(HOLIDAY_FEED);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("reaches 국내 휴장 once the feed arrives", async () => {
    render(
      <MarketDataProvider>
        <MarketStatusBadge />
      </MarketDataProvider>
    );

    await waitFor(() => expect(screen.getByText("국내 휴장")).toBeTruthy());
    expect(screen.queryByText("국내장 거래 중")).toBeNull();
  });

  // Before the answer lands there is nothing to go on but the calendar, and the
  // calendar thinks this Monday is a trading day. It must not stay that way.
  it("corrects itself from the opening guess", async () => {
    let resolveFeed: (value: MarketsResponse) => void = () => {};
    api.fetchMarkets.mockReturnValue(
      new Promise<MarketsResponse>((resolve) => {
        resolveFeed = resolve;
      })
    );

    render(
      <MarketDataProvider>
        <MarketStatusBadge />
      </MarketDataProvider>
    );

    expect(screen.getByText("국내장 거래 중")).toBeTruthy();

    resolveFeed(HOLIDAY_FEED);
    await waitFor(() => expect(screen.getByText("국내 휴장")).toBeTruthy());
  });
});
