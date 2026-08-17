/**
 * What the badge said on 2026-08-17, a substitute holiday: 국내장 거래 중.
 * KRX was closed all day. The badge now reads the session the market feed
 * observes, and calls a weekday-inside-hours-but-closed what it is: 휴장.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const session = vi.hoisted(() => ({
  trading: false,
  source: "observed" as "observed" | "clock",
}));

vi.mock("../../../hooks/useKrxSession", () => ({
  useKrxSession: () => session,
}));

const { MarketStatusBadge } = await import("../MarketStatusBadge");

/** Monday 2026-08-17 14:54 KST — inside the hours, and a holiday. */
const HOLIDAY_AFTERNOON = new Date("2026-08-17T05:54:00.000Z");
/** Friday 2026-08-14 14:00 KST. */
const TRADING_AFTERNOON = new Date("2026-08-14T05:00:00.000Z");
/** Friday 2026-08-14 22:00 KST. */
const WEEKDAY_NIGHT = new Date("2026-08-14T13:00:00.000Z");
/** Saturday 2026-08-15 12:00 KST. */
const WEEKEND = new Date("2026-08-15T03:00:00.000Z");

function renderAt(now: Date, trading: boolean) {
  session.trading = trading;
  vi.setSystemTime(now);
  return render(<MarketStatusBadge />);
}

describe("MarketStatusBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says 휴장 when the clock says trading hours but the market is closed", () => {
    renderAt(HOLIDAY_AFTERNOON, false);
    expect(screen.getByText("국내 휴장")).toBeTruthy();
    expect(screen.queryByText("국내장 거래 중")).toBeNull();
  });

  it("says 거래 중 only when the market is actually open", () => {
    renderAt(TRADING_AFTERNOON, true);
    expect(screen.getByText("국내장 거래 중")).toBeTruthy();
  });

  it("says 야간 참고가격 after the close", () => {
    renderAt(WEEKDAY_NIGHT, false);
    expect(screen.getByText("야간 참고가격")).toBeTruthy();
  });

  it("says 주말 참고가격 at the weekend", () => {
    renderAt(WEEKEND, false);
    expect(screen.getByText("주말 참고가격")).toBeTruthy();
  });
});
