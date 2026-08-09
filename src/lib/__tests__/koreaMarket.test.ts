import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getLastKrxCloseMs } from "../koreaMarket";

// 2026-08-07T06:30:00.000Z = Friday 2026-08-07 15:30:00 KST (KRX close)
const FRI_AUG07_CLOSE_UTC = new Date("2026-08-07T06:30:00.000Z").getTime();
// 2026-08-10T06:30:00.000Z = Monday 2026-08-10 15:30:00 KST
const MON_AUG10_CLOSE_UTC = new Date("2026-08-10T06:30:00.000Z").getTime();

describe("getLastKrxCloseMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Friday close for Sunday KST (session = closed, anchor = 08/07)", () => {
    // 2026-08-09 12:00 KST = 2026-08-09 03:00 UTC (Sunday)
    const sunday = new Date("2026-08-09T03:00:00.000Z");
    expect(getLastKrxCloseMs(sunday)).toBe(FRI_AUG07_CLOSE_UTC);
  });

  it("returns Friday close for Saturday KST", () => {
    // 2026-08-08 12:00 KST = 2026-08-08 03:00 UTC (Saturday)
    const saturday = new Date("2026-08-08T03:00:00.000Z");
    expect(getLastKrxCloseMs(saturday)).toBe(FRI_AUG07_CLOSE_UTC);
  });

  it("returns today's close for weekday at 21:00 KST (past 15:30 close)", () => {
    // 2026-08-10 21:00 KST = 2026-08-10 12:00 UTC (Monday, past close)
    const monday = new Date("2026-08-10T12:00:00.000Z");
    expect(getLastKrxCloseMs(monday)).toBe(MON_AUG10_CLOSE_UTC);
  });

  it("returns previous Friday close for Monday at 08:00 KST (before open)", () => {
    // 2026-08-10 08:00 KST = 2026-08-09 23:00 UTC (still Mon KST, before open)
    const monday = new Date("2026-08-09T23:00:00.000Z");
    expect(getLastKrxCloseMs(monday)).toBe(FRI_AUG07_CLOSE_UTC);
  });

  it("returns today's close for weekday exactly at 15:30 KST", () => {
    // 2026-08-10 15:30 KST = 2026-08-10 06:30 UTC (Monday, exactly at close)
    const atClose = new Date("2026-08-10T06:30:00.000Z");
    expect(getLastKrxCloseMs(atClose)).toBe(MON_AUG10_CLOSE_UTC);
  });

  it("returns Friday close for weekday at 09:00 KST (before close, after open)", () => {
    // 2026-08-10 09:00 KST = 2026-08-10 00:00 UTC (Monday, before close)
    const mondayMorning = new Date("2026-08-10T00:00:00.000Z");
    expect(getLastKrxCloseMs(mondayMorning)).toBe(FRI_AUG07_CLOSE_UTC);
  });
});
