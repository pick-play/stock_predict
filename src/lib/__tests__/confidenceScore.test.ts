import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calculateConfidenceScore } from "../confidenceScore";
import type { NormalizedQuote } from "../binance/types";

const NOW = new Date("2026-08-03T12:00:00.000Z"); // 2026-08-03 = Monday (KST weekday)

function makeQuote(overrides: Partial<NormalizedQuote> = {}): NormalizedQuote {
  return {
    symbol: "SAMSUNGUSDT",
    lastPrice: 73.42,
    markPrice: 73.45,
    indexPrice: 73.41,
    bidPrice: 73.4,
    askPrice: 73.44,
    volume24h: 125_000,
    changePercent24h: 2.3,
    fundingRate: 0.0001,
    eventTime: NOW.toISOString(), // fresh — same as system time
    source: "binance-rest",
    ...overrides,
  };
}

describe("calculateConfidenceScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 100 for fully healthy data on a weekday", () => {
    const score = calculateConfidenceScore({
      quote: makeQuote(),
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(100);
  });

  it("returns 0 when quote is null", () => {
    const score = calculateConfidenceScore({
      quote: null,
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(0);
  });

  it("deducts 10 points when data is more than 1 minute old", () => {
    const oldTime = new Date(NOW.getTime() - 90_000).toISOString(); // 1.5 min ago
    const score = calculateConfidenceScore({
      quote: makeQuote({ eventTime: oldTime }),
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(90);
  });

  it("deducts 40 points total when data is more than 5 minutes old", () => {
    const oldTime = new Date(NOW.getTime() - 6 * 60_000).toISOString(); // 6 min ago
    const score = calculateConfidenceScore({
      quote: makeQuote({ eventTime: oldTime }),
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    // -10 (>1min) + -30 (>5min) = -40
    expect(score).toBe(60);
  });

  it("deducts 10 points when spread is wide (>0.5%)", () => {
    // spread = (ask - bid) / ask > 0.005
    const score = calculateConfidenceScore({
      quote: makeQuote({ bidPrice: 70.0, askPrice: 74.0 }), // spread ~5.4%
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(90);
  });

  it("deducts 10 points when bid/ask are missing", () => {
    const score = calculateConfidenceScore({
      quote: makeQuote({ bidPrice: null, askPrice: null }),
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(90);
  });

  it("deducts 15 points for low 24h volume", () => {
    const score = calculateConfidenceScore({
      quote: makeQuote({ volume24h: 500 }), // < 1000
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(85);
  });

  it("deducts 10 points when markPrice is null", () => {
    const score = calculateConfidenceScore({
      quote: makeQuote({ markPrice: null }),
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: false,
    });
    expect(score).toBe(90);
  });

  it("deducts 25 points when no anchor is available", () => {
    const score = calculateConfidenceScore({
      quote: makeQuote(),
      hasAnchor: false,
      anchorTimeMs: null,
      usingFallback: false,
    });
    expect(score).toBe(75);
  });

  it("deducts 25 points when the anchor predates the last KRX close", () => {
    // NOW = 2026-08-03 Monday 21:00 KST (past close) → lastKrxClose = Aug 3 06:30 UTC
    // oldBaseline = 3 days earlier (Jul 31), which is before Aug 3 close → penalty
    const oldAnchor = NOW.getTime() - 3 * 24 * 60 * 60_000;
    const score = calculateConfidenceScore({
      quote: makeQuote(),
      hasAnchor: true,
      anchorTimeMs: oldAnchor,
      usingFallback: false,
    });
    expect(score).toBe(75);
  });

  it("does not penalise a Friday anchor on Sunday (weekend gap is expected)", () => {
    // Sunday 2026-08-09 12:00 KST = 03:00 UTC
    // Last KRX close = Friday 2026-08-07 06:30 UTC
    // Baseline captured 1 minute after close = 06:31 UTC Friday → should NOT be stale
    vi.setSystemTime(new Date("2026-08-09T03:00:00.000Z"));
    const fridayCloseAnchor = new Date("2026-08-07T06:30:00.000Z").getTime();
    const score = calculateConfidenceScore({
      quote: makeQuote({ eventTime: "2026-08-09T03:00:00.000Z" }),
      hasAnchor: true,
      anchorTimeMs: fridayCloseAnchor,
      usingFallback: false,
    });
    // -10 for weekend; no staleness penalty
    expect(score).toBe(90);
  });

  it("deducts 20 points when using fallback data", () => {
    const score = calculateConfidenceScore({
      quote: makeQuote(),
      hasAnchor: true,
      anchorTimeMs: NOW.getTime(),
      usingFallback: true,
    });
    expect(score).toBe(80);
  });

  it("clamps score to minimum of 0", () => {
    const oldTime = new Date(NOW.getTime() - 6 * 60_000).toISOString();
    const score = calculateConfidenceScore({
      quote: makeQuote({
        eventTime: oldTime,
        markPrice: null,
        bidPrice: null,
        askPrice: null,
        volume24h: 100,
      }),
      hasAnchor: false,
      anchorTimeMs: null,
      usingFallback: true,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("deducts 10 points on weekends (KST Saturday)", () => {
    // 2026-08-08 is a Saturday — use 01:00 UTC = 10:00 KST (Saturday)
    vi.setSystemTime(new Date("2026-08-08T01:00:00.000Z"));
    const weekendTime = new Date("2026-08-08T01:00:00.000Z").toISOString();
    const score = calculateConfidenceScore({
      quote: makeQuote({ eventTime: weekendTime }),
      hasAnchor: true,
      anchorTimeMs: new Date(weekendTime).getTime(),
      usingFallback: false,
    });
    expect(score).toBe(90); // -10 for weekend
  });
});
