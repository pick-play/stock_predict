import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StockSnapshot } from "../../../types/market";

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
      wsStatus="connected"
      chartOpen={false}
      onToggleChart={() => {}}
      chartPanelId="stock-chart-panel"
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

  /*
   * The chart itself lives on the page, at full width below both cards. Inside a
   * card it made the grid row as tall as the chart and stretched the other card
   * into a large empty box beside it. So the card's job is now only to report the
   * request and reflect the state.
   */
  it("asks the page to open the chart", async () => {
    const user = userEvent.setup();
    const onToggleChart = vi.fn();
    renderCard({ onToggleChart });

    await user.click(screen.getByRole("button", { name: "차트 보기" }));

    expect(onToggleChart).toHaveBeenCalledOnce();
  });

  it("renders no chart of its own", () => {
    renderCard({ chartOpen: true });
    expect(screen.queryByRole("img", { name: /가격 추이/ })).toBeNull();
  });

  it("labels the control by the open state it was given", () => {
    renderCard({ chartOpen: true });
    expect(screen.getByRole("button", { name: "차트 닫기" })).toBeTruthy();
  });

  it("points aria-controls at the page's panel", () => {
    renderCard({ chartOpen: true, chartPanelId: "stock-chart-panel" });
    const button = screen.getByRole("button", { name: "차트 닫기" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe("stock-chart-panel");
  });

  it("reports closed when it is not the open card", () => {
    renderCard({ chartOpen: false });
    const button = screen.getByRole("button", { name: "차트 보기" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
