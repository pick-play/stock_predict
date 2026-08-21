/**
 * 주말 참고가격 starts when New York closes, not when Seoul's Saturday does.
 *
 * Saturday in Korea begins while the American session still has hours to run,
 * and the estimate moves on that volume — warning about thin weekend liquidity
 * then describes a market that is open. The boundary is read from New York's
 * clock because the offset is nine hours under DST and ten without it.
 */

import { describe, it, expect } from "vitest";
import { isWeekend } from "../koreaMarket";

/** 2026-08-21 is a Friday; August is EDT (UTC-4), so 16:00 ET = 05:00 KST Sat. */
const SUMMER = {
  fridayUsOpen: new Date("2026-08-21T15:00:00.000Z"), // Fri 11:00 ET / Sat 00:00 KST
  justBeforeClose: new Date("2026-08-21T19:59:00.000Z"), // Fri 15:59 ET / Sat 04:59 KST
  atClose: new Date("2026-08-21T20:00:00.000Z"), // Fri 16:00 ET / Sat 05:00 KST
};

/** 2026-01-16 is a Friday in EST (UTC-5), so 16:00 ET = 06:00 KST Saturday. */
const WINTER = {
  justBeforeClose: new Date("2026-01-16T20:59:00.000Z"), // Fri 15:59 ET / Sat 05:59 KST
  atClose: new Date("2026-01-16T21:00:00.000Z"), // Fri 16:00 ET / Sat 06:00 KST
};

describe("isWeekend", () => {
  it("is not the weekend while New York is still trading on Friday", () => {
    expect(isWeekend(SUMMER.fridayUsOpen)).toBe(false);
    expect(isWeekend(SUMMER.justBeforeClose)).toBe(false);
  });

  it("becomes the weekend at the closing bell", () => {
    expect(isWeekend(SUMMER.atClose)).toBe(true);
  });

  // The same boundary in Korean hours moves by one when DST ends; a fixed KST
  // hour would be wrong for half the year.
  it("uses New York's clock, so the KST hour shifts with DST", () => {
    expect(isWeekend(WINTER.justBeforeClose)).toBe(false);
    expect(isWeekend(WINTER.atClose)).toBe(true);
  });

  it("stays the weekend through Saturday and Sunday in Seoul", () => {
    // Sat 21:00 KST / Sat 08:00 ET
    expect(isWeekend(new Date("2026-08-22T12:00:00.000Z"))).toBe(true);
    // Sun 12:00 KST
    expect(isWeekend(new Date("2026-08-23T03:00:00.000Z"))).toBe(true);
    // Sun 23:00 KST — still Sunday in Seoul
    expect(isWeekend(new Date("2026-08-23T14:00:00.000Z"))).toBe(true);
  });

  it("ends with Monday in Seoul", () => {
    // Mon 00:00 KST, which is Sunday 11:00 ET — the site is back to its
    // ordinary overnight state ahead of the domestic open.
    expect(isWeekend(new Date("2026-08-23T15:00:00.000Z"))).toBe(false);
  });

  it("is never the weekend midweek", () => {
    expect(isWeekend(new Date("2026-08-19T05:00:00.000Z"))).toBe(false); // Wed
    expect(isWeekend(new Date("2026-08-20T13:00:00.000Z"))).toBe(false); // Thu night
  });
});
