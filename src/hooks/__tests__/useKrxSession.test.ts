/**
 * 2026-08-17 was a substitute holiday for 광복절. It was a Monday, so the
 * calendar said trading hours and the site announced 국내장 거래 중 while KRX
 * was shut. The market feed knew better the whole time — it reported the KOSPI
 * session as closed with the last one ending on 08-14.
 *
 * These tests pin the rule that came out of it: what the feed observes beats
 * what the calendar predicts, and the calendar is only consulted when the feed
 * has nothing to say.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { TickerItem, TickerMarketStatus } from "../../types/ticker";

const feed = vi.hoisted(() => ({ items: [] as TickerItem[], isLoading: false }));

vi.mock("../../lib/markets/marketDataContext", () => ({
  useSharedMarketData: () => feed,
}));

const { useKrxSession } = await import("../useKrxSession");

/** 2026-08-17 14:54 KST — a Monday inside 09:00–15:30, and a holiday. */
const HOLIDAY_AFTERNOON = new Date("2026-08-17T05:54:00.000Z");
/** 2026-08-14 14:00 KST — an ordinary Friday session. */
const TRADING_AFTERNOON = new Date("2026-08-14T05:00:00.000Z");
/** 2026-08-14 22:00 KST — after the close. */
const WEEKDAY_NIGHT = new Date("2026-08-14T13:00:00.000Z");

function setKospi(status: TickerMarketStatus | null) {
  feed.items = status
    ? ([
        {
          id: "kospi",
          label: "코스피",
          price: 3300,
          changePercent: 0,
          decimals: 2,
          unit: "",
          status,
          isStale: false,
          isLive: false,
        },
      ] as TickerItem[])
    : [];
}

describe("useKrxSession", () => {
  beforeEach(() => {
    setKospi(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says closed on a holiday even inside trading hours", () => {
    setKospi("closed");
    const { result } = renderHook(() => useKrxSession(HOLIDAY_AFTERNOON));

    expect(result.current.trading).toBe(false);
    expect(result.current.source).toBe("observed");
  });

  it("says trading when the feed reports an open session", () => {
    setKospi("open");
    const { result } = renderHook(() => useKrxSession(TRADING_AFTERNOON));

    expect(result.current.trading).toBe(true);
    expect(result.current.source).toBe("observed");
  });

  // The feed is the authority even when the calendar would agree anyway.
  it("still reports observed after hours", () => {
    setKospi("closed");
    const { result } = renderHook(() => useKrxSession(WEEKDAY_NIGHT));
    expect(result.current).toEqual({ trading: false, source: "observed" });
  });

  it("falls back to the clock before the feed has answered", () => {
    setKospi(null);
    const { result } = renderHook(() => useKrxSession(TRADING_AFTERNOON));

    expect(result.current.trading).toBe(true);
    expect(result.current.source).toBe("clock");
  });

  it("treats an unknown session as no answer at all", () => {
    setKospi("unknown");
    const { result } = renderHook(() => useKrxSession(WEEKDAY_NIGHT));

    expect(result.current.trading).toBe(false);
    expect(result.current.source).toBe("clock");
  });
});
