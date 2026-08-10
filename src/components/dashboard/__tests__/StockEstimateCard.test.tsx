import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StockSnapshot } from "../../../types/market";

// Recharts is heavy and irrelevant here; the assertions are about the card's own
// affordances, not the chart's internals.
vi.mock("../LazyPriceChart", () => ({
  LazyPriceChart: ({ stockId }: { stockId?: string }) => (
    <div data-testid="chart">{`chart:${stockId ?? "all"}`}</div>
  ),
}));

vi.mock("../ShareCardButton", () => ({
  ShareCardButton: () => <button type="button">이미지 저장</button>,
}));

const { StockEstimateCard } = await import("../StockEstimateCard");

const NOW = new Date("2026-08-10T13:00:00.000Z");

function snapshot(overrides: Partial<StockSnapshot> = {}): StockSnapshot {
  return {
    displayName: "삼성전자",
    koreanTicker: "005930",
    binanceSymbol: "SAMSUNGUSDT",
    krxClose: 230000,
    baselineBinancePrice: 182.63,
    currentBinancePrice: 165.31,
    referencePriceMode: "mark",
    bidPrice: 165.31,
    askPrice: 165.33,
    spreadPercent: 0.012,
    confidenceScore: 90,
    eventTime: new Date(NOW.getTime() - 10_000).toISOString(),
    rawEstimatedPrice: 208200.5,
    estimatedPrice: 208000,
    changeAmount: -22000,
    changeRate: -0.0948,
    status: "healthy",
    ...overrides,
  } as StockSnapshot;
}

function renderCard(props: Partial<Parameters<typeof StockEstimateCard>[0]> = {}) {
  return render(
    <StockEstimateCard
      snapshot={snapshot()}
      stockId="samsung"
      history={[]}
      chartRange="24h"
      onChartRangeChange={() => {}}
      wsStatus="connected"
      {...props}
    />
  );
}

describe("StockEstimateCard footer state", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The confidence score and its meter were replaced by a live-state readout.
  it("no longer shows a confidence score", () => {
    renderCard();
    expect(screen.queryByText("데이터 양호")).toBeNull();
    expect(screen.queryByText(/\/100/)).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("says 실시간 when the socket is connected and the tick is recent", () => {
    renderCard();
    expect(screen.getByText("실시간")).toBeTruthy();
  });

  // The card must not keep a green light on a price that stopped moving.
  it("degrades to 갱신 지연 once the tick ages past the warning threshold", () => {
    renderCard({
      snapshot: snapshot({
        eventTime: new Date(NOW.getTime() - 6 * 60_000).toISOString(),
      }),
    });
    expect(screen.getByText("갱신 지연")).toBeTruthy();
    expect(screen.queryByText("실시간")).toBeNull();
  });

  it("says 업데이트 중단 once the tick is critically old", () => {
    renderCard({
      snapshot: snapshot({
        eventTime: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
      }),
    });
    expect(screen.getByText("업데이트 중단")).toBeTruthy();
  });

  it("does not claim 실시간 while the socket is down", () => {
    renderCard({ wsStatus: "disconnected" });
    expect(screen.getByText("연결 재시도 중")).toBeTruthy();
    expect(screen.queryByText("실시간")).toBeNull();
  });
});

describe("StockEstimateCard chart toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the chart unmounted until asked for", () => {
    renderCard();
    expect(screen.queryByTestId("chart")).toBeNull();
    expect(screen.getByRole("button", { name: "차트 보기" })).toBeTruthy();
  });

  it("reveals the chart pinned to this card's stock", async () => {
    const user = userEvent.setup();
    renderCard({ stockId: "skHynix" });

    await user.click(screen.getByRole("button", { name: "차트 보기" }));

    // Pinned, so it cannot show the other company's series.
    expect(screen.getByTestId("chart").textContent).toBe("chart:skHynix");
    expect(screen.getByRole("button", { name: "차트 닫기" })).toBeTruthy();
  });

  it("collapses again on a second press", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "차트 보기" }));
    await user.click(screen.getByRole("button", { name: "차트 닫기" }));

    expect(screen.queryByTestId("chart")).toBeNull();
  });

  it("wires aria-expanded and aria-controls to the panel", async () => {
    const user = userEvent.setup();
    renderCard();

    const button = screen.getByRole("button", { name: "차트 보기" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    await user.click(button);

    const toggled = screen.getByRole("button", { name: "차트 닫기" });
    expect(toggled.getAttribute("aria-expanded")).toBe("true");
    const panelId = toggled.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeTruthy();
  });
});
