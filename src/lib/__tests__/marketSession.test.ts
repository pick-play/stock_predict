import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveAnchor, seoulDateString, anchorBasisLabel } from "../marketSession";
import type { Baseline } from "../../types/market";

function makeBaseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    schemaVersion: 2,
    timezone: "Asia/Seoul",
    updatedAt: "2026-08-10T06:40:00.000Z",
    referencePriceMode: "mark",
    open: {
      marketDate: "2026-08-10",
      anchorTimeUtc: "2026-08-10T00:00:00.000Z",
      stocks: { samsung: { krxPrice: 240_000 }, skHynix: { krxPrice: 1_500_000 } },
    },
    close: {
      marketDate: "2026-08-07",
      anchorTimeUtc: "2026-08-07T06:30:00.000Z",
      stocks: { samsung: { krxPrice: 231_000 }, skHynix: { krxPrice: 1_422_000 } },
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("seoulDateString", () => {
  it("uses the Seoul calendar day, not UTC", () => {
    // 2026-08-09T16:00Z is already 2026-08-10 01:00 in Seoul
    expect(seoulDateString(new Date("2026-08-09T16:00:00.000Z"))).toBe("2026-08-10");
  });
});

describe("resolveAnchor", () => {
  it("uses today's open during regular hours", () => {
    // Monday 2026-08-10 11:00 KST = 02:00 UTC
    at("2026-08-10T02:00:00.000Z");
    const anchor = resolveAnchor(makeBaseline());
    expect(anchor?.kind).toBe("open");
    expect(anchor?.marketDate).toBe("2026-08-10");
    expect(anchor?.krxPrice.samsung).toBe(240_000);
  });

  it("uses the last close after the bell", () => {
    // Monday 2026-08-10 20:00 KST = 11:00 UTC
    at("2026-08-10T11:00:00.000Z");
    const anchor = resolveAnchor(makeBaseline());
    expect(anchor?.kind).toBe("close");
    expect(anchor?.krxPrice.samsung).toBe(231_000);
  });

  it("uses the last close on weekends", () => {
    // Sunday 2026-08-09 16:00 KST = 07:00 UTC
    at("2026-08-09T07:00:00.000Z");
    const anchor = resolveAnchor(makeBaseline());
    expect(anchor?.kind).toBe("close");
    expect(anchor?.marketDate).toBe("2026-08-07");
  });

  it("uses the last close before the open bell", () => {
    // Monday 2026-08-10 08:30 KST = 2026-08-09 23:30 UTC
    at("2026-08-09T23:30:00.000Z");
    expect(resolveAnchor(makeBaseline())?.kind).toBe("close");
  });

  it("falls back to close when today's open has not been captured yet", () => {
    // Regular hours, but the open anchor still holds Friday's date
    at("2026-08-10T02:00:00.000Z");
    const stale = makeBaseline({
      open: {
        marketDate: "2026-08-07",
        anchorTimeUtc: "2026-08-07T00:00:00.000Z",
        stocks: { samsung: { krxPrice: 235_000 }, skHynix: { krxPrice: 1_521_000 } },
      },
    });
    const anchor = resolveAnchor(stale);
    expect(anchor?.kind).toBe("close");
    expect(anchor?.marketDate).toBe("2026-08-07");
  });

  it("resolves the anchor instant as UTC milliseconds", () => {
    at("2026-08-09T07:00:00.000Z");
    const anchor = resolveAnchor(makeBaseline());
    expect(anchor?.anchorTimeMs).toBe(Date.parse("2026-08-07T06:30:00.000Z"));
  });

  it("returns null without a baseline", () => {
    expect(resolveAnchor(null)).toBeNull();
  });

  it("returns null when both anchors are missing", () => {
    at("2026-08-09T07:00:00.000Z");
    expect(resolveAnchor(makeBaseline({ open: null, close: null }))).toBeNull();
  });

  it("rejects an anchor with a non-positive price", () => {
    at("2026-08-09T07:00:00.000Z");
    const broken = makeBaseline({
      open: null,
      close: {
        marketDate: "2026-08-07",
        anchorTimeUtc: "2026-08-07T06:30:00.000Z",
        stocks: { samsung: { krxPrice: 0 }, skHynix: { krxPrice: 1_422_000 } },
      },
    });
    expect(resolveAnchor(broken)).toBeNull();
  });
});

describe("anchorBasisLabel", () => {
  it("describes each basis in Korean", () => {
    expect(anchorBasisLabel("open")).toBe("오늘 시가 기준");
    expect(anchorBasisLabel("close")).toBe("최근 종가 기준");
  });
});
