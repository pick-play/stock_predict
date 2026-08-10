import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TickerItem } from "../../../types/ticker";

const mockState = vi.hoisted(() => ({
  current: { items: [] as TickerItem[], isLoading: false },
}));

vi.mock("../../../lib/markets/marketDataContext", () => ({
  useSharedMarketData: () => mockState.current,
}));

const { MarketIndexGrid } = await import("../MarketIndexGrid");

function item(overrides: Partial<TickerItem> = {}): TickerItem {
  return {
    id: "kospi",
    label: "코스피",
    price: 6299.66,
    changePercent: 0.65,
    decimals: 2,
    unit: "",
    status: "open",
    isStale: false,
    isLive: false,
    ...overrides,
  };
}

describe("MarketIndexGrid", () => {
  beforeEach(() => {
    mockState.current = { items: [], isLoading: false };
  });

  it("renders nothing when the feed came back empty", () => {
    const { container } = render(<MarketIndexGrid />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows placeholder cells while the first fetch is in flight", () => {
    mockState.current = { items: [], isLoading: true };
    render(<MarketIndexGrid />);
    expect(screen.getByRole("region", { name: "주요 증시" })).toBeTruthy();
  });

  it("renders one cell per instrument, unduplicated", () => {
    mockState.current = {
      items: [item(), item({ id: "kosdaq", label: "코스닥" })],
      isLoading: false,
    };
    render(<MarketIndexGrid />);
    // Unlike the tape, the grid must not double its items.
    expect(screen.getAllByText("코스피")).toHaveLength(1);
    expect(screen.getAllByText("코스닥")).toHaveLength(1);
  });

  it("formats the value in percentage points with a direction arrow", () => {
    mockState.current = { items: [item()], isLoading: false };
    render(<MarketIndexGrid />);
    expect(screen.getByText("6,299.66")).toBeTruthy();
    expect(screen.getByText(/▲/)).toBeTruthy();
    expect(screen.getByText(/\+0\.65%/)).toBeTruthy();
  });

  it("labels a closed market 장 마감", () => {
    mockState.current = { items: [item({ status: "closed" })], isLoading: false };
    render(<MarketIndexGrid />);
    expect(screen.getByText("장 마감")).toBeTruthy();
  });

  it("reserves 실시간 for a genuinely live row", () => {
    mockState.current = {
      items: [item({ id: "bitcoin", label: "비트코인", isLive: true })],
      isLoading: false,
    };
    render(<MarketIndexGrid />);
    expect(screen.getByText("실시간")).toBeTruthy();
    expect(screen.queryByText("장중")).toBeNull();
  });

  it("keeps the delay caveat visible so the badges do not over-promise", () => {
    mockState.current = { items: [item()], isLoading: false };
    render(<MarketIndexGrid />);
    expect(screen.getByText(/지연될 수 있습니다/)).toBeTruthy();
  });
});
