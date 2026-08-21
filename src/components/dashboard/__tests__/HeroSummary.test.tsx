/**
 * The page no longer opens with branding.
 *
 * The name, the 야간 선물 headline and the subtitle sat above the prices and
 * pushed them off a phone screen. They were there for search, and search reads
 * the footer just as well. What is left changes with the clock — including the
 * notice §13 requires while the exchange is open.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const market = vi.hoisted(() => ({ isWeekend: vi.fn(() => false) }));
const session = vi.hoisted(() => ({ trading: false }));

vi.mock("../../../lib/koreaMarket", () => market);
vi.mock("../../../hooks/useKrxSession", () => ({
  useKrxSession: () => session,
}));

const { HeroSummary } = await import("../HeroSummary");

describe("HeroSummary", () => {
  beforeEach(() => {
    market.isWeekend.mockReturnValue(false);
    session.trading = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing on an ordinary weekday night", () => {
    const { container } = render(<HeroSummary />);
    expect(container).toBeEmptyDOMElement();
  });

  it("carries no branding of its own any more", () => {
    session.trading = true;
    render(<HeroSummary />);
    expect(screen.queryByText(/코스피 NOW/)).toBeNull();
    expect(screen.queryByText(/해외 선물가격 기반 코스피 야간 선물/)).toBeNull();
    expect(screen.queryByText(/언제 어디서나/)).toBeNull();
  });

  // §13: while the exchange is open, real fills come first. Not optional.
  it("warns that real fills come first during regular hours", () => {
    session.trading = true;
    render(<HeroSummary />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("정규장");
    expect(alert.textContent).toContain("실제 체결가");
  });

  it("notes thin weekend liquidity", () => {
    market.isWeekend.mockReturnValue(true);
    render(<HeroSummary />);
    expect(screen.getByRole("alert").textContent).toContain("변동성");
  });

  it("prefers the trading-hours notice over the weekend one", () => {
    market.isWeekend.mockReturnValue(true);
    session.trading = true;
    render(<HeroSummary />);
    expect(screen.getByRole("alert").textContent).toContain("정규장");
  });
});
