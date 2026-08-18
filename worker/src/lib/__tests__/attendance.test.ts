/**
 * Attendance is counted in Seoul days, on the user row.
 *
 * The streak rules are the part worth pinning: they are easy to state and easy
 * to get wrong at a month boundary, and they are the number a reader will
 * notice being wrong.
 */

import { describe, it, expect } from "vitest";
import {
  nextAttendance,
  previousSeoulDate,
  seoulDate,
} from "../attendance";

describe("seoulDate", () => {
  it("uses the Korean calendar day, not UTC", () => {
    // 16:00Z is already the next day in Seoul.
    expect(seoulDate(new Date("2026-08-17T16:00:00.000Z"))).toBe("2026-08-18");
    expect(seoulDate(new Date("2026-08-17T14:59:00.000Z"))).toBe("2026-08-17");
  });
});

describe("previousSeoulDate", () => {
  it("steps back one day", () => {
    expect(previousSeoulDate("2026-08-18")).toBe("2026-08-17");
  });

  it("crosses a month boundary", () => {
    expect(previousSeoulDate("2026-09-01")).toBe("2026-08-31");
  });

  it("crosses a year boundary", () => {
    expect(previousSeoulDate("2026-01-01")).toBe("2025-12-31");
  });

  it("handles a leap day", () => {
    expect(previousSeoulDate("2028-03-01")).toBe("2028-02-29");
  });
});

describe("nextAttendance", () => {
  it("counts a first ever visit", () => {
    const next = nextAttendance(
      { lastVisitDate: null, visitDays: 0, visitStreak: 0 },
      "2026-08-18"
    );
    expect(next).toEqual({ visitDays: 1, visitStreak: 1, changed: true });
  });

  // The guard that keeps this to one write per member per day.
  it("writes nothing on the second visit of the same day", () => {
    const next = nextAttendance(
      { lastVisitDate: "2026-08-18", visitDays: 5, visitStreak: 3 },
      "2026-08-18"
    );
    expect(next).toEqual({ visitDays: 5, visitStreak: 3, changed: false });
  });

  it("continues a streak from yesterday", () => {
    const next = nextAttendance(
      { lastVisitDate: "2026-08-17", visitDays: 5, visitStreak: 3 },
      "2026-08-18"
    );
    expect(next).toEqual({ visitDays: 6, visitStreak: 4, changed: true });
  });

  it("restarts the streak after a missed day", () => {
    const next = nextAttendance(
      { lastVisitDate: "2026-08-16", visitDays: 5, visitStreak: 3 },
      "2026-08-18"
    );
    expect(next).toEqual({ visitDays: 6, visitStreak: 1, changed: true });
  });

  it("continues across a month boundary", () => {
    const next = nextAttendance(
      { lastVisitDate: "2026-08-31", visitDays: 30, visitStreak: 30 },
      "2026-09-01"
    );
    expect(next.visitStreak).toBe(31);
  });

  // Total days only ever goes up; a broken streak is not a lost day.
  it("keeps counting total days when a streak breaks", () => {
    const next = nextAttendance(
      { lastVisitDate: "2026-01-01", visitDays: 99, visitStreak: 12 },
      "2026-08-18"
    );
    expect(next.visitDays).toBe(100);
    expect(next.visitStreak).toBe(1);
  });
});
