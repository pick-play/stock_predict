import { describe, it, expect } from "vitest";
import {
  formatReleaseWhen,
  formatCountdown,
  isToday,
} from "../format";

/*
 * All fixtures are the real publication instants the collector produces for an
 * 08:30 Eastern release, so the daylight-saving pair is exercised rather than
 * assumed: the same wall clock in New York is 21:30 in Seoul in August and
 * 22:30 in January.
 */
const AUG_RELEASE = "2026-08-12T12:30:00.000Z"; // 08:30 EDT → 21:30 KST
const JAN_RELEASE = "2026-01-13T13:30:00.000Z"; // 08:30 EST → 22:30 KST

describe("formatReleaseWhen", () => {
  it("renders a summer release in Seoul time", () => {
    expect(formatReleaseWhen(AUG_RELEASE)).toBe("08/12 21:30");
  });

  // The hour differs from the line above by exactly the US DST shift. Formatting
  // through the zone rather than adding a fixed offset is what keeps this right.
  it("renders a winter release an hour later in Seoul", () => {
    expect(formatReleaseWhen(JAN_RELEASE)).toBe("01/13 22:30");
  });

  // 14:00 in New York is the next calendar day in Seoul.
  it("rolls the date when the release is a Seoul small-hours event", () => {
    expect(formatReleaseWhen("2026-09-16T18:00:00.000Z")).toBe("09/17 03:00");
  });
});

describe("formatCountdown", () => {
  const release = new Date(AUG_RELEASE).getTime();

  it("counts hours within the same Seoul day", () => {
    expect(formatCountdown(AUG_RELEASE, release - 3 * 3_600_000)).toBe("3시간 뒤");
  });

  it("counts minutes in the last hour", () => {
    expect(formatCountdown(AUG_RELEASE, release - 20 * 60_000)).toBe("20분 뒤");
  });

  it("says 잠시 뒤 under a minute", () => {
    expect(formatCountdown(AUG_RELEASE, release - 30_000)).toBe("잠시 뒤");
  });

  /*
   * Counted between Seoul calendar dates, not by dividing the duration. A
   * release at 21:30 tomorrow is 30 hours away, which a duration-based count
   * would call "1일 뒤" only by luck and "30시간 뒤" at worst.
   */
  it("says 내일 for the next Seoul day", () => {
    // 08/11 15:00 KST → the release is on 08/12.
    const evening = Date.UTC(2026, 7, 11, 6, 0);
    expect(formatCountdown(AUG_RELEASE, evening)).toBe("내일");
  });

  it("counts whole days beyond tomorrow", () => {
    const threeDaysBefore = Date.UTC(2026, 7, 9, 6, 0); // 08/09 15:00 KST
    expect(formatCountdown(AUG_RELEASE, threeDaysBefore)).toBe("3일 뒤");
  });

  it("reports a past release as published", () => {
    expect(formatCountdown(AUG_RELEASE, release + 60_000)).toBe("발표됨");
  });

  it("degrades to an empty string on an unparseable instant", () => {
    expect(formatCountdown("not-a-date")).toBe("");
  });
});

describe("isToday", () => {
  it("is true within the same Seoul date", () => {
    // 08/12 09:00 KST, release is 08/12 21:30 KST.
    expect(isToday(AUG_RELEASE, Date.UTC(2026, 7, 12, 0, 0))).toBe(true);
  });

  /*
   * The boundary that matters: 08/12 00:30 UTC is still 08/12 in Seoul, but
   * 08/11 15:30 UTC is already 08/12 there. Comparing UTC dates would get both
   * of these wrong.
   */
  it("is true just after Seoul midnight rolls over", () => {
    expect(isToday(AUG_RELEASE, Date.UTC(2026, 7, 11, 15, 30))).toBe(true);
  });

  it("is false the Seoul day before", () => {
    expect(isToday(AUG_RELEASE, Date.UTC(2026, 7, 11, 14, 0))).toBe(false);
  });
});
