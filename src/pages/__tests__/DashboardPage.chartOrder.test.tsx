/**
 * Where the chart lands when a card asks for it.
 *
 * On a phone the cards stack, and the chart used to be a sibling parked after
 * both of them: pressing 차트 보기 on 삼성전자 opened a panel underneath
 * SK하이닉스, two screens from the button that opened it. The chart is now a
 * grid child whose CSS order places it directly after its own card, and is
 * returned to source order at md — inside the two-column row it would stretch
 * the neighbouring card and leave a tall empty box beside it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StockSnapshot } from "../../types/market";

function snapshot(displayName: string, ticker: string): StockSnapshot {
  return {
    displayName,
    koreanTicker: ticker,
    binanceSymbol: "X",
    krxClose: 100000,
    baselineBinancePrice: 100,
    currentBinancePrice: 101,
    referencePriceMode: "mark",
    bidPrice: 100.9,
    askPrice: 101.1,
    spreadPercent: 0.02,
    confidenceScore: 90,
    eventTime: new Date().toISOString(),
    rawEstimatedPrice: 101000,
    estimatedPrice: 101000,
    changeAmount: 1000,
    changeRate: 0.01,
    status: "healthy",
  } as StockSnapshot;
}

vi.mock("../../hooks/useMarketData", () => ({
  useMarketData: () => ({
    stocks: {
      samsung: snapshot("삼성전자", "005930"),
      skHynix: snapshot("SK하이닉스", "000660"),
    },
    history: [],
    isLoading: false,
    error: null,
    lastUpdated: new Date(),
    usingFallback: false,
    wsStatus: "connected",
  }),
}));

vi.mock("../../hooks/useChartHistory", () => ({
  useChartHistory: () => ({ history: [], isLoading: false, anchors: {} }),
}));

// The chart itself is lazy and irrelevant here; only its placement is tested.
vi.mock("../../components/dashboard/LazyPriceChart", () => ({
  LazyPriceChart: () => <div>차트</div>,
}));
vi.mock("../../components/dashboard/MarketIndexGrid", () => ({
  MarketIndexGrid: () => null,
}));
vi.mock("../../components/dashboard/EconomicCalendar", () => ({
  EconomicCalendar: () => null,
}));
vi.mock("../../components/dashboard/RecentChatStrip", () => ({
  RecentChatStrip: () => null,
}));
vi.mock("../../components/dashboard/CommunityHotList", () => ({
  CommunityHotList: () => null,
}));
vi.mock("../../components/common/MarketTicker", () => ({
  MarketTicker: () => null,
}));

const { DashboardPage } = await import("../DashboardPage");

const PANEL_ID = "stock-chart-panel";

function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const card = heading.closest("article");
  if (!card) throw new Error(`no card for ${name}`);
  return card;
}

describe("DashboardPage chart placement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stacks the cards in source order on a phone", () => {
    render(<DashboardPage />);
    expect(cardFor("삼성전자").className).toContain("order-1");
    expect(cardFor("SK하이닉스").className).toContain("order-3");
  });

  it("puts the chart right under 삼성전자 when that card opens it", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const [samsungButton] = screen.getAllByRole("button", { name: "차트 보기" });
    await user.click(samsungButton);

    const panel = document.getElementById(PANEL_ID);
    expect(panel).toBeTruthy();
    // Between 삼성전자 (1) and SK하이닉스 (3).
    expect(panel!.className).toContain("order-2");
  });

  it("puts the chart under SK하이닉스 when that card opens it", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const buttons = screen.getAllByRole("button", { name: "차트 보기" });
    await user.click(buttons[1]);

    expect(document.getElementById(PANEL_ID)!.className).toContain("order-4");
  });

  it("shares the grid with the cards, so the order applies at all", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getAllByRole("button", { name: "차트 보기" })[0]);

    const panel = document.getElementById(PANEL_ID)!;
    expect(panel.parentElement).toBe(cardFor("삼성전자").parentElement);
  });

  // Desktop is unchanged: last, and across both columns.
  it("returns to source order and full width at md", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getAllByRole("button", { name: "차트 보기" })[0]);

    const panel = document.getElementById(PANEL_ID)!;
    expect(panel.className).toContain("md:order-none");
    expect(panel.className).toContain("md:col-span-2");
  });
});
