import { describe, it, expect } from "vitest";
import { normalizeTicker, normalizePremiumIndex, normalizeFuturesTicker } from "../binance/normalizer";
import { selectReferencePrice } from "../binance/types";
import type {
  BinanceTickerResponse,
  BinancePremiumIndexResponse,
  BinanceFutures24hrTicker,
  BinanceFuturesBookTicker,
} from "../binance/types";

const validTicker: BinanceTickerResponse = {
  symbol: "SAMSUNGUSDT",
  lastPrice: "73.42",
  bidPrice: "73.40",
  askPrice: "73.44",
  volume: "125000",
  priceChangePercent: "2.30",
  time: 1722596400000, // 2024-08-02T11:00:00.000Z
};

const validPremiumIndex: BinancePremiumIndexResponse = {
  symbol: "SAMSUNGUSDT",
  markPrice: "73.45",
  indexPrice: "73.41",
  lastFundingRate: "0.0001",
  time: 1722596400000,
};

describe("normalizeTicker", () => {
  it("maps all fields correctly", () => {
    const quote = normalizeTicker(validTicker);
    expect(quote.symbol).toBe("SAMSUNGUSDT");
    expect(quote.lastPrice).toBe(73.42);
    expect(quote.bidPrice).toBe(73.4);
    expect(quote.askPrice).toBe(73.44);
    expect(quote.volume24h).toBe(125000);
    expect(quote.changePercent24h).toBe(2.3);
    expect(quote.markPrice).toBeNull();
    expect(quote.indexPrice).toBeNull();
    expect(quote.fundingRate).toBeNull();
    expect(quote.source).toBe("binance-rest");
    expect(quote.eventTime).toBe(new Date(1722596400000).toISOString());
  });

  it("returns null for invalid price strings", () => {
    const ticker: BinanceTickerResponse = {
      ...validTicker,
      lastPrice: "0",
      bidPrice: "NaN",
      askPrice: "-1",
    };
    const quote = normalizeTicker(ticker);
    expect(quote.lastPrice).toBeNull();
    expect(quote.bidPrice).toBeNull();
    expect(quote.askPrice).toBeNull();
  });

  it("uses current time when ticker has no time field", () => {
    const tickerNoTime = { ...validTicker };
    delete tickerNoTime.time;
    const before = Date.now();
    const quote = normalizeTicker(tickerNoTime);
    const after = Date.now();
    const eventMs = new Date(quote.eventTime).getTime();
    expect(eventMs).toBeGreaterThanOrEqual(before);
    expect(eventMs).toBeLessThanOrEqual(after);
  });

  it("accepts a source override", () => {
    const quote = normalizeTicker(validTicker, "binance-websocket");
    expect(quote.source).toBe("binance-websocket");
  });
});

describe("normalizePremiumIndex", () => {
  it("maps mark/index/funding fields from premium index", () => {
    const quote = normalizePremiumIndex(validPremiumIndex, validTicker);
    expect(quote.symbol).toBe("SAMSUNGUSDT");
    expect(quote.markPrice).toBe(73.45);
    expect(quote.indexPrice).toBe(73.41);
    expect(quote.fundingRate).toBe(0.0001);
    expect(quote.lastPrice).toBe(73.42);
    expect(quote.bidPrice).toBe(73.4);
    expect(quote.askPrice).toBe(73.44);
  });

  it("returns null bid/ask/volume when no ticker is provided", () => {
    const quote = normalizePremiumIndex(validPremiumIndex, null);
    expect(quote.lastPrice).toBeNull();
    expect(quote.bidPrice).toBeNull();
    expect(quote.askPrice).toBeNull();
    expect(quote.volume24h).toBeNull();
  });

  it("returns null for zero or invalid markPrice", () => {
    const pi: BinancePremiumIndexResponse = { ...validPremiumIndex, markPrice: "0" };
    const quote = normalizePremiumIndex(pi, null);
    expect(quote.markPrice).toBeNull();
  });
});

describe("selectReferencePrice", () => {
  const baseQuote = {
    symbol: "SAMSUNGUSDT",
    lastPrice: 70.0,
    markPrice: 73.45,
    indexPrice: 73.41,
    bidPrice: 73.4,
    askPrice: 73.44,
    volume24h: 125000,
    changePercent24h: 2.3,
    fundingRate: 0.0001,
    eventTime: new Date().toISOString(),
    source: "binance-rest" as const,
  };

  it("returns markPrice for mode='mark'", () => {
    expect(selectReferencePrice(baseQuote, "mark")).toBe(73.45);
  });

  it("returns mid price for mode='mid'", () => {
    // (73.4 + 73.44) / 2 = 73.42
    expect(selectReferencePrice(baseQuote, "mid")).toBeCloseTo(73.42, 5);
  });

  it("returns lastPrice for mode='last'", () => {
    expect(selectReferencePrice(baseQuote, "last")).toBe(70.0);
  });

  it("falls back to markPrice when mark is null in mode='mark'", () => {
    const q = { ...baseQuote, markPrice: null };
    // fallback chain: mark is null → try mid
    expect(selectReferencePrice(q, "mark")).toBeCloseTo(73.42, 5);
  });

  it("falls back to lastPrice when mid has bid>ask in fallback chain", () => {
    const q = {
      ...baseQuote,
      markPrice: null,
      bidPrice: 74.0,
      askPrice: 73.0, // bid > ask — invalid
    };
    // fallback chain: mark null, mid invalid → lastPrice
    expect(selectReferencePrice(q, "mark")).toBe(70.0);
  });

  it("returns null when no valid price is available", () => {
    const q = {
      ...baseQuote,
      markPrice: null,
      bidPrice: null,
      askPrice: null,
      lastPrice: null,
    };
    expect(selectReferencePrice(q, "mark")).toBeNull();
  });

  it("rejects mid when bid > ask in mode='mid'", () => {
    const q = { ...baseQuote, markPrice: null, bidPrice: 74.0, askPrice: 73.0 };
    // mode=mid but bid>ask → falls back to lastPrice
    expect(selectReferencePrice(q, "mid")).toBe(70.0);
  });
});

describe("normalizeFuturesTicker", () => {
  const futures24hr: BinanceFutures24hrTicker = {
    symbol: "SAMSUNGUSDT",
    lastPrice: "165.35000",
    priceChangePercent: "1.212",
    volume: "137014.53",
    closeTime: 1785677248040,
  };

  const premiumIndex: BinancePremiumIndexResponse = {
    symbol: "SAMSUNGUSDT",
    markPrice: "165.32000000",
    indexPrice: "165.25368385",
    lastFundingRate: "-0.00052834",
    time: 1785677255143,
  };

  const bookTicker: BinanceFuturesBookTicker = {
    symbol: "SAMSUNGUSDT",
    bidPrice: "165.26000",
    askPrice: "165.29000",
    time: 1785677267448,
  };

  it("populates markPrice and indexPrice from premiumIndex", () => {
    const quote = normalizeFuturesTicker(futures24hr, premiumIndex, bookTicker);
    expect(quote.markPrice).toBeCloseTo(165.32, 2);
    expect(quote.indexPrice).toBeCloseTo(165.2537, 4);
    expect(quote.fundingRate).toBeCloseTo(-0.00052834, 8);
  });

  it("populates lastPrice and volume from 24hr ticker", () => {
    const quote = normalizeFuturesTicker(futures24hr, premiumIndex, bookTicker);
    expect(quote.lastPrice).toBeCloseTo(165.35, 2);
    expect(quote.volume24h).toBeCloseTo(137014.53, 1);
    expect(quote.changePercent24h).toBeCloseTo(1.212, 3);
  });

  it("populates bid/ask from bookTicker", () => {
    const quote = normalizeFuturesTicker(futures24hr, premiumIndex, bookTicker);
    expect(quote.bidPrice).toBeCloseTo(165.26, 2);
    expect(quote.askPrice).toBeCloseTo(165.29, 2);
  });

  it("returns null bid/ask when bookTicker is null", () => {
    const quote = normalizeFuturesTicker(futures24hr, premiumIndex, null);
    expect(quote.bidPrice).toBeNull();
    expect(quote.askPrice).toBeNull();
  });

  it("uses premiumIndex.time for eventTime", () => {
    const quote = normalizeFuturesTicker(futures24hr, premiumIndex, bookTicker);
    expect(quote.eventTime).toBe(new Date(1785677255143).toISOString());
  });

  it("returns null for zero or negative markPrice", () => {
    const pi: BinancePremiumIndexResponse = { ...premiumIndex, markPrice: "0" };
    const quote = normalizeFuturesTicker(futures24hr, pi, null);
    expect(quote.markPrice).toBeNull();
  });

  it("uses 'binance-rest' as default source", () => {
    const quote = normalizeFuturesTicker(futures24hr, premiumIndex, null);
    expect(quote.source).toBe("binance-rest");
  });
});
