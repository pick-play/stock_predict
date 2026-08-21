import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

/**
 * What the card shows without being asked, and what waits behind 상세보기.
 *
 * Owner decision (2026-08-21). One line stays out — the domestic close the
 * estimate is measured from — because without it the headline price has no
 * origin. The rest describes how the calculation was performed, which is a
 * question somebody asks deliberately.
 */
describe("StockEstimateCard details toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("always shows the domestic anchor the price came from", () => {
    renderCard();
    expect(screen.getByText(/최근 국내 종가|국내 시가/)).toBeTruthy();
    expect(screen.getByText("230,000원")).toBeTruthy();
  });

  it("keeps the calculation rows out of the way until asked", () => {
    renderCard();
    expect(screen.queryByText("현재 해외 선물가")).toBeNull();
    expect(screen.queryByText(/^기준가/)).toBeNull();
    expect(screen.queryByText("매수 / 매도 호가")).toBeNull();
    expect(screen.queryByText("호가 스프레드")).toBeNull();
  });

  it("shows them all on any screen once opened", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "상세보기" }));

    // No desktop-only rows any more: opening the panel is the opt-in.
    for (const label of [
      "현재 해외 선물가",
      "매수 / 매도 호가",
      "호가 스프레드",
    ]) {
      const row = screen.getByText(label).closest("[data-metric-row]");
      expect(row).toBeTruthy();
      expect(row!.className).not.toContain("hidden");
    }
    expect(screen.getByText(/^기준가/)).toBeTruthy();
  });

  it("closes again", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "상세보기" }));
    await user.click(screen.getByRole("button", { name: "상세 닫기" }));

    expect(screen.queryByText("현재 해외 선물가")).toBeNull();
  });

  it("ties the button to the panel it opens", async () => {
    const user = userEvent.setup();
    renderCard();

    const button = screen.getByRole("button", { name: "상세보기" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    await user.click(button);
    const opened = screen.getByRole("button", { name: "상세 닫기" });
    expect(opened.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(opened.getAttribute("aria-controls")!)).toBeTruthy();
  });
});

/**
 * A phone showed two lines under 기준가: the row's own bottom border plus the
 * footer's top border. `last:border-0` looks at DOM children, and the
 * desktop-only rows are still children on a phone — just invisible — so the last
 * row a phone can see never qualified as last.
 */
describe("StockEstimateCard metric dividers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function rows() {
    // Attribute, not a class: the padding these rows use is design surface and
    // has already changed under this test once.
    return Array.from(document.querySelectorAll("[data-metric-row]"));
  }

  it("draws dividers on the top edge, never the bottom", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "상세보기" }));

    const all = rows();
    expect(all.length).toBeGreaterThan(2);
    all.forEach((row) => {
      expect(row.className).toContain("border-t");
      expect(row.className).not.toContain("border-b");
    });
  });

  // Anchoring to first: is what makes a hidden trailing row harmless.
  it("skips the divider above the first row only", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "상세보기" }));

    expect(rows()[0].className).toContain("first:border-0");
    expect(rows()[0].className).not.toContain("last:border-0");
  });
});

/**
 * The card must not re-render on the seconds clock.
 *
 * Its footer counts seconds, but only that readout needs to; when the card body
 * shared the same subscription, every second re-rendered the price block, the
 * sparkline and the metric table — sixty times a minute, per card, for as long
 * as the page stayed open. On a phone that is paid for in battery and heat.
 */
describe("StockEstimateCard render cost", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("leaves the card body alone while the seconds tick", async () => {
    // getDataFreshness runs once per body render, so its call count is a proxy
    // for how often the card re-rendered.
    const staleData = await import("../../../lib/staleData");
    const freshness = vi.spyOn(staleData, "getDataFreshness");

    renderCard();
    const initial = freshness.mock.calls.length;
    expect(initial).toBeGreaterThan(0);

    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
    }

    // Ten seconds pass and the body was never re-rendered: its clock is coarse
    // enough that no boundary was crossed.
    expect(freshness.mock.calls.length).toBe(initial);

    /*
     * There is no seconds readout to check any more — it was removed once the
     * 실시간 badge said the same thing. The coarse clock stays because the badge
     * itself degrades on a stale tick, and that must still happen.
     */
    expect(screen.getByText("실시간")).toBeTruthy();
  });
});

/**
 * What the card is for, in order: which stock, what it is worth tonight, which
 * way it moved. Everything else explains those three and must not compete with
 * them — the name used to be 14px, the same size as a metric label.
 */
describe("StockEstimateCard hierarchy", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the company name above every other piece of text", () => {
    renderCard();
    const name = screen.getByRole("heading", { name: "삼성전자" });
    expect(name.className).toContain("text-2xl");
    expect(name.className).toContain("font-bold");
  });

  it("keeps the price the largest thing on the card", () => {
    renderCard();
    const price = screen.getByLabelText(/예상가격 208,000원/);
    // clamp() so it grows with the card rather than being pinned to one size.
    expect(price.getAttribute("style")).toContain("clamp");
  });

  /*
   * The change sits on its own line directly under the price (owner decision,
   * 2026-08-21). Beside it — where it was briefly — it read as a footnote to
   * the number rather than the second thing worth knowing.
   */
  it("puts the change on its own line under the price", () => {
    renderCard();
    const price = screen.getByLabelText(/예상가격 208,000원/);
    const change = price.nextElementSibling;

    expect(change?.textContent).toContain("▼");
    expect(change?.textContent).toContain("-9.48%");
    // Large enough to be read second, not last.
    expect(change?.className).toContain("text-lg");
  });

  // Colour is never the only signal (§11.2).
  it("still states the direction with a symbol and a sign", () => {
    renderCard();
    const price = screen.getByLabelText(/예상가격 208,000원/);
    expect(price.nextElementSibling?.textContent).toMatch(/▼\s*-22,000원/);
  });

  /*
   * The line above the price carries the live state and then the caption —
   * "is this current" and "what is it" — in that order, both immediately above
   * the figure they qualify. The badge used to live in the card header, a whole
   * block away from the number.
   */
  it("labels the price and states its freshness directly above it", () => {
    renderCard();
    const price = screen.getByLabelText(/예상가격 208,000원/);
    const above = price.previousElementSibling;

    expect(above?.textContent).toBe("실시간예상가");
    expect(above?.firstElementChild?.textContent).toBe("실시간");
  });

  it("keeps the supporting rows smaller than the headline", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "상세보기" }));

    const rows = document.querySelectorAll("[data-metric-row]");
    expect(rows.length).toBeGreaterThan(0);
    // Same size as the 최근 국내 종가 line they sit under: they are one list,
    // and two sizes in one list reads as a mistake.
    rows.forEach((row) => {
      expect(row.querySelector("span")?.className).toContain("text-[0.6875rem]");
    });
  });
});

/**
 * The card's three actions read as one control.
 *
 * They were a left-aligned pair with the share button pushed to the far edge,
 * which left the bottom of the card looking unfinished. Equal cells in one row,
 * and the row last, give it a base.
 */
describe("StockEstimateCard actions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the three actions in one row", () => {
    renderCard();
    const chart = screen.getByRole("button", { name: "차트 보기" });
    const details = screen.getByRole("button", { name: "상세보기" });

    expect(chart.parentElement).toBe(details.parentElement);
    expect(chart.parentElement?.className).toContain("grid-cols-3");
  });

  it("styles them identically", () => {
    renderCard();
    const chart = screen.getByRole("button", { name: "차트 보기" });
    const details = screen.getByRole("button", { name: "상세보기" });

    expect(details.className).toBe(chart.className);
    // The share control is mocked in this file, so its class cannot be read
    // here — its own test file covers that it takes the class it is handed.
  });

  it("ends the card with the actions, under the anchor line", () => {
    renderCard();
    const row = screen.getByRole("button", { name: "차트 보기" }).parentElement;
    const foot = row?.parentElement;

    expect(foot?.textContent).toContain("최근 국내 종가");
    // Last interactive row. Only the maker's mark sits below it.
    expect(foot?.lastElementChild?.previousElementSibling).toBe(row);
  });
});

/**
 * The anchor line and the rows behind 상세보기 are one list. They were 11px and
 * 12px in different greys, which reads as two things that failed to line up
 * rather than one list with a heading.
 */
describe("StockEstimateCard foot typography", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the detail rows at the same size as the anchor line", async () => {
    const user = userEvent.setup();
    renderCard();

    const anchorLabel = screen.getByText(/최근 국내 종가|국내 시가/);
    await user.click(screen.getByRole("button", { name: "상세보기" }));
    const detailLabel = screen.getByText("현재 해외 선물가");

    const size = (el: Element) =>
      (el.className.match(/text-\[[\d.]+rem\]/) ?? [])[0];

    expect(size(detailLabel)).toBe(size(anchorLabel));
    expect(size(detailLabel)).toBe("text-[0.6875rem]");
  });
});

/**
 * Every gap in the foot list has a line in it.
 *
 * The one between 최근 국내 종가 and 현재 해외 선물가 did not: each row draws its
 * own top border except the first, and "first" is relative to the details
 * wrapper, so the wrapper has to supply that one.
 */
describe("StockEstimateCard foot dividers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rules between the anchor line and the first detail row", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "상세보기" }));

    const panel = document.getElementById("stock-details-005930");
    expect(panel?.className).toContain("border-t");

    // …and the row itself must not add a second one on top of it.
    const firstRow = screen.getByText("현재 해외 선물가").closest("[data-metric-row]");
    expect(firstRow?.className).toContain("first:border-0");
  });
});

/**
 * A maker's mark under the actions.
 *
 * Screenshots of this card travel further than the site does, and a card
 * cropped out of a phone screen otherwise carries nothing saying where the
 * number came from. It must stay a mark: no row of its own, no shrinking of the
 * buttons above it, and out of the accessibility tree — a screen reader that
 * announced the brand on every card would be reading furniture.
 */
describe("StockEstimateCard maker's mark", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("signs the card under the actions", () => {
    renderCard();
    const mark = document.querySelector("[aria-hidden='true'].text-center");

    expect(mark?.textContent).toBe("코스피 NOW");
    expect(
      screen.getByRole("button", { name: "차트 보기" }).parentElement
        ?.nextElementSibling
    ).toBe(mark);
  });

  it("stays small enough to read as an edge, not a line of content", () => {
    renderCard();
    const mark = document.querySelector("[aria-hidden='true'].text-center");

    expect(mark?.className).toContain("text-[0.5625rem]");
    expect(mark?.className).toContain("opacity-60");
  });

  /*
   * queryByText would still find it — ByText ignores aria-hidden — so the
   * attribute itself is what gets asserted. A screen reader announcing the
   * brand on every card would be reading furniture.
   */
  it("is not announced to a screen reader", () => {
    renderCard();
    const mark = document.querySelector(".text-center.opacity-60");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });
});
