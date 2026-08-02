import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatKrw,
  formatPercent,
  formatChangeAmount,
  formatDirectionSymbol,
  getDirection,
  formatKoreanTime,
  formatRelativeTime,
} from "../format";

describe("formatKrw", () => {
  it("formats integer values with Korean thousand separator and 원 suffix", () => {
    expect(formatKrw(100_000)).toBe("100,000원");
    expect(formatKrw(1_000_000)).toBe("1,000,000원");
    expect(formatKrw(0)).toBe("0원");
    expect(formatKrw(72_200)).toBe("72,200원");
  });

  it("rounds to nearest integer (not KRX tick — that is a separate step)", () => {
    // Intl.NumberFormat with maximumFractionDigits:0 rounds to the nearest integer
    expect(formatKrw(100_000.9)).toBe("100,001원");
    expect(formatKrw(99_999.4)).toBe("99,999원");
  });
});

describe("formatPercent", () => {
  it("returns '0.00%' for exactly zero (no sign)", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("adds + sign for positive values", () => {
    expect(formatPercent(0.0123)).toBe("+1.23%");
    expect(formatPercent(0.3)).toBe("+30.00%");
  });

  it("keeps − sign for negative values without adding +", () => {
    expect(formatPercent(-0.0086)).toBe("-0.86%");
    expect(formatPercent(-0.1)).toBe("-10.00%");
  });

  it("formats to exactly 2 decimal places", () => {
    expect(formatPercent(0.001)).toBe("+0.10%");
  });
});

describe("formatChangeAmount", () => {
  it("returns '0원' for zero (no sign)", () => {
    expect(formatChangeAmount(0)).toBe("0원");
  });

  it("adds + sign for positive amounts", () => {
    expect(formatChangeAmount(2_500)).toBe("+2,500원");
  });

  it("keeps − sign for negative amounts", () => {
    expect(formatChangeAmount(-2_500)).toBe("-2,500원");
  });
});

describe("formatDirectionSymbol", () => {
  it("returns ▲ for positive", () => {
    expect(formatDirectionSymbol(1)).toBe("▲");
    expect(formatDirectionSymbol(0.001)).toBe("▲");
  });

  it("returns ▼ for negative", () => {
    expect(formatDirectionSymbol(-1)).toBe("▼");
    expect(formatDirectionSymbol(-0.001)).toBe("▼");
  });

  it("returns ― for zero", () => {
    expect(formatDirectionSymbol(0)).toBe("―");
  });
});

describe("getDirection", () => {
  it("returns 'rise' for positive values", () => {
    expect(getDirection(0.01)).toBe("rise");
  });

  it("returns 'fall' for negative values", () => {
    expect(getDirection(-0.01)).toBe("fall");
  });

  it("returns 'neutral' for zero", () => {
    expect(getDirection(0)).toBe("neutral");
  });
});

describe("formatKoreanTime", () => {
  beforeEach(() => {
    // Fix system time to 2026-08-02T12:00:00.000Z (21:00:00 KST)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only time when the date is today in Seoul", () => {
    // 2026-08-02T11:30:00.000Z = 20:30:00 KST (same Seoul day)
    const result = formatKoreanTime("2026-08-02T11:30:00.000Z");
    // Should be time only, e.g. "20:30:00"
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("shows month/day + time for dates different from today", () => {
    // 2026-08-01T12:00:00.000Z = different Seoul day
    const result = formatKoreanTime("2026-08-01T12:00:00.000Z");
    // Should contain "월" and "일" (Korean month/day)
    expect(result).toContain("월");
    expect(result).toContain("일");
  });
});

describe("formatRelativeTime", () => {
  const BASE = "2026-08-02T12:00:00.000Z";

  it("shows seconds when less than 60 seconds ago", () => {
    const now = new Date("2026-08-02T12:00:30.000Z");
    expect(formatRelativeTime(BASE, now)).toBe("30초 전");
  });

  it("shows 0초 전 when timestamps are equal", () => {
    const now = new Date(BASE);
    expect(formatRelativeTime(BASE, now)).toBe("0초 전");
  });

  it("shows minutes when 60+ seconds ago", () => {
    const now = new Date("2026-08-02T12:05:00.000Z");
    expect(formatRelativeTime(BASE, now)).toBe("5분 전");
  });

  it("shows hours when 60+ minutes ago", () => {
    const now = new Date("2026-08-02T14:00:00.000Z");
    expect(formatRelativeTime(BASE, now)).toBe("2시간 전");
  });

  it("falls back to current time when now is omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:10.000Z"));
    try {
      expect(formatRelativeTime(BASE)).toBe("10초 전");
    } finally {
      vi.useRealTimers();
    }
  });
});
