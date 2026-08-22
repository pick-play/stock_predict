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
      hyundai: snapshot("현대차", "005380"),
      samsungEM: snapshot("삼성전기", "009150"),
      lgElectronics: snapshot("LG전자", "066570"),
      hanmi: snapshot("한미반도체", "042700"),
      naver: snapshot("NAVER", "035420"),
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
    expect(cardFor("SK하이닉스").className).toContain("order-[11]");
  });

  it("puts the chart right under 삼성전자 when that card opens it", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const [samsungButton] = screen.getAllByRole("button", { name: "차트 보기" });
    await user.click(samsungButton);

    const panel = document.getElementById(PANEL_ID);
    expect(panel).toBeTruthy();
    // Between 삼성전자 (1) and SK하이닉스 (11).
    expect(panel!.className).toContain("order-2");
  });

  it("puts the chart under SK하이닉스 when that card opens it", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const buttons = screen.getAllByRole("button", { name: "차트 보기" });
    await user.click(buttons[1]);

    expect(document.getElementById(PANEL_ID)!.className).toContain("order-[12]");
  });

  it("shares the grid with the cards, so the order applies at all", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getAllByRole("button", { name: "차트 보기" })[0]);

    const panel = document.getElementById(PANEL_ID)!;
    expect(panel.parentElement).toBe(cardFor("삼성전자").parentElement);
  });

  /*
   * A row is one card on a phone and two from md up, so the chart carries an
   * order for each. 삼성전자 opens row 0 either way; what changes is that the
   * desktop panel spans the pair rather than sitting under a single card.
   */
  it("lands under its own row and spans both columns at md", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getAllByRole("button", { name: "차트 보기" })[0]);

    const panel = document.getElementById(PANEL_ID)!;
    expect(panel.className).toContain("md:order-2");
    expect(panel.className).toContain("md:col-span-2");
  });

  it("keeps a phone row per card and a desktop row per pair", () => {
    render(<DashboardPage />);
    // Second card: row 1 of 7 on a phone, still row 0 of 4 beside 삼성전자.
    expect(cardFor("SK하이닉스").className).toContain("order-[11]");
    expect(cardFor("SK하이닉스").className).toContain("md:order-1");
    expect(cardFor("삼성전자").className).toContain("md:order-1");
  });

  /*
   * The orders step by ten so something can be slotted between two rows. The
   * chat strip is that something: it belongs under SK하이닉스, which is after
   * 하이닉스's own chart slot on a phone and after the first pair's on a
   * desktop — two different positions for one element.
   */
  it("puts the chat strip between the first row and the second", () => {
    render(<DashboardPage />);

    const strip = document.querySelector('[class~="order-[15]"]');
    expect(strip).toBeTruthy();
    expect(strip!.className).toContain("md:order-[5]");

    // Phone: after 하이닉스 (11) and its chart slot (12), before 현대차 (21).
    expect(cardFor("현대차").className).toContain("order-[21]");
    // Desktop: after the first pair's chart slot (2), before the next row (11).
    expect(cardFor("현대차").className).toContain("md:order-[11]");
  });
});
