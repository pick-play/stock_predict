import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchKlineHistory } from "../klineHistory";
import type { StockAnchor } from "../klineHistory";
import type { StockId } from "../../../types/market";

/** Minimal kline row: [openTime, open, high, low, close, ...] */
const row = (openTime: number, close: string) => [
  openTime,
  close,
  close,
  close,
  close,
  "0",
];

function mockFetchPerSymbol(bySymbol: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const symbol = new URL(url).searchParams.get("symbol") ?? "";
      const payload = bySymbol[symbol];
      if (payload === undefined) {
        return Promise.resolve({ ok: false, status: 400 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response);
    })
  );
}

const anchors: Partial<Record<StockId, StockAnchor>> = {
  samsung: { krxPrice: 231_000, anchorFuturesPrice: 100 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchKlineHistory", () => {
  it("converts each candle with the anchor and rounds to the KRX tick", async () => {
    // 105/100 = +5% → 231,000 × 1.05 = 242,550 → 500원 단위로 242,500.
    // 이 배율은 야간 가격제한폭(±8%) 안이어야 한다 — 밖이면 이 테스트가
    // 확인하려는 반올림이 아니라 상한 클램프를 확인하게 된다.
    mockFetchPerSymbol({ SAMSUNGUSDT: [row(1_000, "105")] });

    const history = await fetchKlineHistory("1h", anchors);

    expect(history).toHaveLength(1);
    const point = history![0].stocks.samsung!;
    expect(point.estimatedPrice).toBe(242_500);
    expect(point.changeRate).toBeCloseTo(0.05, 10);
    expect(point.currentBinancePrice).toBe(105);
  });

  it("orders points oldest first and stamps them as ISO time", async () => {
    mockFetchPerSymbol({
      SAMSUNGUSDT: [row(3_000, "100"), row(1_000, "100"), row(2_000, "100")],
    });

    const history = await fetchKlineHistory("1h", anchors);

    expect(history!.map((h) => h.timestamp)).toEqual([
      new Date(1_000).toISOString(),
      new Date(2_000).toISOString(),
      new Date(3_000).toISOString(),
    ]);
  });

  it("merges every requested stock onto one timestamp", async () => {
    mockFetchPerSymbol({
      SAMSUNGUSDT: [row(1_000, "110")],
      SKHYNIXUSDT: [row(1_000, "90")],
      NAVERUSDT: [row(1_000, "95")],
    });

    const history = await fetchKlineHistory("24h", {
      samsung: { krxPrice: 231_000, anchorFuturesPrice: 100 },
      skHynix: { krxPrice: 1_422_000, anchorFuturesPrice: 100 },
      naver: { krxPrice: 219_500, anchorFuturesPrice: 100 },
    });

    expect(history).toHaveLength(1);
    expect(history![0].stocks.samsung).toBeDefined();
    expect(history![0].stocks.skHynix).toBeDefined();
    expect(history![0].stocks.naver).toBeDefined();
  });

  // The symbol is looked up in MARKET_SYMBOLS, so a listing added to the config
  // reaches the chart with no change here — this pins that lookup for a stock
  // added after the original pair.
  it("requests a newly listed stock under its configured symbol", async () => {
    mockFetchPerSymbol({ HANMIUSDT: [row(1_000, "100")] });

    const history = await fetchKlineHistory("1h", {
      hanmi: { krxPrice: 225_500, anchorFuturesPrice: 100 },
    });

    expect(history![0].stocks.hanmi?.estimatedPrice).toBe(225_500);
  });

  it("keeps the stock that succeeded when the other request fails", async () => {
    mockFetchPerSymbol({ SAMSUNGUSDT: [row(1_000, "110")] });

    const history = await fetchKlineHistory("24h", {
      samsung: { krxPrice: 231_000, anchorFuturesPrice: 100 },
      skHynix: { krxPrice: 1_422_000, anchorFuturesPrice: 100 },
    });

    expect(history![0].stocks.samsung).toBeDefined();
    expect(history![0].stocks.skHynix).toBeUndefined();
  });

  it("returns null without a usable anchor rather than guessing one", async () => {
    mockFetchPerSymbol({ SAMSUNGUSDT: [row(1_000, "110")] });

    expect(
      await fetchKlineHistory("1h", {
        samsung: { krxPrice: 0, anchorFuturesPrice: 100 },
      })
    ).toBeNull();
    expect(await fetchKlineHistory("1h", {})).toBeNull();
  });

  it("returns null when the response carries no usable candle", async () => {
    mockFetchPerSymbol({ SAMSUNGUSDT: [] });
    expect(await fetchKlineHistory("1h", anchors)).toBeNull();
  });

  it("skips malformed rows instead of plotting NaN", async () => {
    mockFetchPerSymbol({
      SAMSUNGUSDT: [row(1_000, "110"), [2_000, "x"], row(3_000, "abc")],
    });

    const history = await fetchKlineHistory("1h", anchors);
    expect(history).toHaveLength(1);
    expect(history![0].timestamp).toBe(new Date(1_000).toISOString());
  });

  it("requests the candle size that matches the range", async () => {
    mockFetchPerSymbol({ SAMSUNGUSDT: [row(1_000, "100")] });
    await fetchKlineHistory("7d", anchors);

    const url = (fetch as unknown as { mock: { calls: string[][] } }).mock
      .calls[0][0];
    expect(url).toContain("interval=1h");
    expect(url).toContain("limit=168");
  });
});
