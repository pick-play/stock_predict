import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDataFreshness, isDataStale, getAgeMs } from "../staleData";

const NOW = new Date("2026-08-02T12:00:00.000Z");

describe("getDataFreshness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'fresh' when data is less than 5 minutes old", () => {
    const recent = new Date(NOW.getTime() - 30_000).toISOString(); // 30s ago
    expect(getDataFreshness(recent)).toBe("fresh");
  });

  it("returns 'fresh' at exactly 4 minutes 59 seconds", () => {
    const t = new Date(NOW.getTime() - (5 * 60_000 - 1)).toISOString();
    expect(getDataFreshness(t)).toBe("fresh");
  });

  it("returns 'warning' when data is between 5 and 15 minutes old", () => {
    const sixMinAgo = new Date(NOW.getTime() - 6 * 60_000).toISOString();
    expect(getDataFreshness(sixMinAgo)).toBe("warning");
  });

  it("returns 'stale' when data is 15 minutes or older", () => {
    const sixteenMinAgo = new Date(NOW.getTime() - 16 * 60_000).toISOString();
    expect(getDataFreshness(sixteenMinAgo)).toBe("stale");
  });

  it("returns 'stale' when eventTime is far in the future (lying clock)", () => {
    const tenMinAhead = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    expect(getDataFreshness(tenMinAhead)).toBe("stale");
  });

  it("stays 'fresh' under minor future clock skew", () => {
    const thirtySecAhead = new Date(NOW.getTime() + 30_000).toISOString();
    expect(getDataFreshness(thirtySecAhead)).toBe("fresh");
  });

  it("returns 'unknown' for null", () => {
    expect(getDataFreshness(null)).toBe("unknown");
  });

  it("returns 'unknown' for undefined", () => {
    expect(getDataFreshness(undefined)).toBe("unknown");
  });
});

describe("isDataStale", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for fresh data", () => {
    const recent = new Date(NOW.getTime() - 60_000).toISOString();
    expect(isDataStale(recent)).toBe(false);
  });

  it("returns false for warning-level data", () => {
    const sixMinAgo = new Date(NOW.getTime() - 6 * 60_000).toISOString();
    expect(isDataStale(sixMinAgo)).toBe(false);
  });

  it("returns true only for stale data", () => {
    const sixteenMinAgo = new Date(NOW.getTime() - 16 * 60_000).toISOString();
    expect(isDataStale(sixteenMinAgo)).toBe(true);
  });

  it("returns false for null (unknown is not stale)", () => {
    expect(isDataStale(null)).toBe(false);
  });

  it("returns true for a far-future eventTime", () => {
    const oneHourAhead = new Date(NOW.getTime() + 60 * 60_000).toISOString();
    expect(isDataStale(oneHourAhead)).toBe(true);
  });
});

describe("getAgeMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the age in milliseconds", () => {
    const twoMinAgo = new Date(NOW.getTime() - 120_000).toISOString();
    expect(getAgeMs(twoMinAgo)).toBe(120_000);
  });

  it("returns null for null input", () => {
    expect(getAgeMs(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getAgeMs(undefined)).toBeNull();
  });
});
