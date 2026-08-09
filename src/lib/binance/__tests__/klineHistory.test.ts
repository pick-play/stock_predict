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
    // 110/100 = +10% → 231,000 × 1.1 = 254,100 → 500원 단위로 254,000
    mockFetchPerSymbol({ SAMSUNGUSDT: [row(1_000, "110")] });

    const history = await fetchKlineHistory("1h", anchors);

    expect(history).toHaveLength(1);
    const point = history![0].stocks.samsung!;
    expect(point.estimatedPrice).toBe(254_000);
    expect(point.changeRate).toBeCloseTo(0.1, 10);
    expect(point.currentBinancePrice).toBe(110);
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

  it("merges both stocks onto one timestamp", async () => {
    mockFetchPerSymbol({
      SAMSUNGUSDT: [row(1_000, "110")],
      SKHYNIXUSDT: [row(1_000, "90")],
    });

    const history = await fetchKlineHistory("24h", {
      samsung: { krxPrice: 231_000, anchorFuturesPrice: 100 },
      skHynix: { krxPrice: 1_422_000, anchorFuturesPrice: 100 },
    });

    expect(history).toHaveLength(1);
    expect(history![0].stocks.samsung).toBeDefined();
    expect(history![0].stocks.skHynix).toBeDefined();
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
