import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TickerItem } from "../../../types/ticker";

const mockState = vi.hoisted(() => ({
  current: { items: [] as TickerItem[], isLoading: false },
}));

vi.mock("../../../lib/markets/marketDataContext", () => ({
  useSharedMarketData: () => mockState.current,
}));

const { MarketTicker } = await import("../MarketTicker");

function item(overrides: Partial<TickerItem> = {}): TickerItem {
  return {
    id: "sp500",
    label: "S&P 500",
    price: 7757.64,
    changePercent: 0.62,
    decimals: 2,
    unit: "",
    status: "open",
    isStale: false,
    isLive: false,
    ...overrides,
  };
}

describe("MarketTicker", () => {
  beforeEach(() => {
    mockState.current = { items: [], isLoading: false };
  });

  it("renders nothing once loading finished with no quotes", () => {
    const { container } = render(<MarketTicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reserves a strip while the first fetch is in flight", () => {
    mockState.current = { items: [], isLoading: true };
    const { container } = render(<MarketTicker />);
    expect(container.firstElementChild).not.toBeNull();
  });

  it("duplicates the item list so the scroll loop has no seam", () => {
    mockState.current = { items: [item()], isLoading: false };
    render(<MarketTicker />);
    // One cell per copy of the list.
    expect(screen.getAllByText("S&P 500")).toHaveLength(2);
  });

  it("shows the value and a signed percentage in points", () => {
    mockState.current = { items: [item()], isLoading: false };
    render(<MarketTicker />);
    expect(screen.getAllByText("7,757.64").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+0\.62%/).length).toBeGreaterThan(0);
  });

  it("marks a closed market 장 마감", () => {
    mockState.current = {
      items: [item({ status: "closed" })],
      isLoading: false,
    };
    render(<MarketTicker />);
    expect(screen.getAllByText("장 마감").length).toBeGreaterThan(0);
  });

  it("calls only a genuinely live feed 실시간", () => {
    mockState.current = {
      items: [item({ id: "bitcoin", label: "비트코인", isLive: true })],
      isLoading: false,
    };
    render(<MarketTicker />);
    expect(screen.getAllByText("실시간").length).toBeGreaterThan(0);
    expect(screen.queryByText("장중")).toBeNull();
  });

  it("flags a delayed open market rather than passing it off as current", () => {
    mockState.current = {
      items: [item({ isStale: true })],
      isLoading: false,
    };
    render(<MarketTicker />);
    expect(screen.getAllByText("지연").length).toBeGreaterThan(0);
  });

  // A closed market's last print is old by definition; the 장 마감 badge already
  // says so, and stacking 지연 on top would read as a data fault.
  it("does not stack 지연 on a closed market", () => {
    mockState.current = {
      items: [item({ status: "closed", isStale: false })],
      isLoading: false,
    };
    render(<MarketTicker />);
    expect(screen.queryByText("지연")).toBeNull();
  });

  it("renders the unit separately from the number", () => {
    mockState.current = {
      items: [item({ id: "oil", label: "WTI유", price: 79.37, unit: "USD/bbl" })],
      isLoading: false,
    };
    render(<MarketTicker />);
    expect(screen.getAllByText("USD/bbl").length).toBeGreaterThan(0);
  });

  it("gives assistive tech one static summary instead of the moving copies", () => {
    mockState.current = {
      items: [item(), item({ id: "kospi", label: "코스피", price: 6299.66 })],
      isLoading: false,
    };
    render(<MarketTicker />);
    const region = screen.getByRole("region", { name: "주요 지수 시세" });
    const summary = region.querySelector(".sr-only");
    expect(summary?.textContent).toContain("S&P 500");
    expect(summary?.textContent).toContain("코스피");
  });

  it("keeps direction readable without colour", () => {
    mockState.current = {
      items: [item({ changePercent: -0.86 })],
      isLoading: false,
    };
    render(<MarketTicker />);
    // ▼ plus an explicit minus sign, per §11.2 and §19.
    expect(screen.getAllByText(/▼/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-0\.86%/).length).toBeGreaterThan(0);
  });
});
