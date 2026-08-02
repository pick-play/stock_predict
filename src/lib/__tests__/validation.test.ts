import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QuoteSchema,
  BaselineStockSchema,
  BaselineSchema,
  LatestDataSchema,
  HistoryArraySchema,
} from "../validation";

const NOW = new Date("2026-08-02T12:00:00.000Z");

describe("QuoteSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const validQuote = {
    symbol: "SAMSUNGUSDT",
    lastPrice: 73.42,
    markPrice: 73.45,
    bidPrice: 73.4,
    askPrice: 73.44,
    eventTime: new Date(NOW.getTime() - 30_000).toISOString(), // 30s ago
  };

  it("accepts valid quote data", () => {
    expect(() => QuoteSchema.parse(validQuote)).not.toThrow();
  });

  it("accepts null price fields", () => {
    const q = { ...validQuote, lastPrice: null, markPrice: null, bidPrice: null, askPrice: null };
    expect(() => QuoteSchema.parse(q)).not.toThrow();
  });

  it("rejects zero prices (must be positive when present)", () => {
    expect(() => QuoteSchema.parse({ ...validQuote, lastPrice: 0 })).toThrow();
  });

  it("rejects negative prices", () => {
    expect(() => QuoteSchema.parse({ ...validQuote, bidPrice: -1 })).toThrow();
  });

  it("rejects eventTime more than 5 minutes in the future", () => {
    const futureTime = new Date(NOW.getTime() + 6 * 60_000).toISOString();
    expect(() => QuoteSchema.parse({ ...validQuote, eventTime: futureTime })).toThrow();
  });

  it("accepts eventTime up to 5 minutes in the future (clock skew tolerance)", () => {
    const nearFuture = new Date(NOW.getTime() + 4 * 60_000).toISOString();
    expect(() => QuoteSchema.parse({ ...validQuote, eventTime: nearFuture })).not.toThrow();
  });

  it("rejects bid > ask", () => {
    const q = { ...validQuote, bidPrice: 74.0, askPrice: 73.0 };
    expect(() => QuoteSchema.parse(q)).toThrow();
  });

  it("accepts bid === ask (zero spread is valid)", () => {
    const q = { ...validQuote, bidPrice: 73.42, askPrice: 73.42 };
    expect(() => QuoteSchema.parse(q)).not.toThrow();
  });

  it("accepts bid < ask (normal spread)", () => {
    const q = { ...validQuote, bidPrice: 73.4, askPrice: 73.44 };
    expect(() => QuoteSchema.parse(q)).not.toThrow();
  });

  it("accepts bid>ask check only when both are non-null", () => {
    // If one is null, the bid<=ask rule cannot apply
    const q = { ...validQuote, bidPrice: null, askPrice: 73.44 };
    expect(() => QuoteSchema.parse(q)).not.toThrow();
  });
});

describe("BaselineStockSchema", () => {
  it("accepts valid baseline stock", () => {
    expect(() =>
      BaselineStockSchema.parse({
        krxClose: 100_000,
        binanceReferencePrice: 71.77,
        referencePriceMode: "mark",
      })
    ).not.toThrow();
  });

  it("rejects krxClose of 0 (must be positive)", () => {
    expect(() =>
      BaselineStockSchema.parse({
        krxClose: 0,
        binanceReferencePrice: 71.77,
        referencePriceMode: "mark",
      })
    ).toThrow();
  });

  it("rejects binanceReferencePrice of 0 (must be positive)", () => {
    expect(() =>
      BaselineStockSchema.parse({
        krxClose: 100_000,
        binanceReferencePrice: 0,
        referencePriceMode: "mark",
      })
    ).toThrow();
  });

  it("rejects invalid referencePriceMode", () => {
    expect(() =>
      BaselineStockSchema.parse({
        krxClose: 100_000,
        binanceReferencePrice: 71.77,
        referencePriceMode: "invalid",
      })
    ).toThrow();
  });
});

describe("BaselineSchema", () => {
  const validBaseline = {
    marketDate: "2026-08-02",
    capturedAt: "2026-08-02T06:31:00.000Z",
    timezone: "Asia/Seoul",
    stocks: {
      samsung: {
        krxClose: 100_000,
        binanceReferencePrice: 71.77,
        referencePriceMode: "mark",
      },
      skHynix: {
        krxClose: 300_000,
        binanceReferencePrice: 215.4,
        referencePriceMode: "mark",
      },
    },
  };

  it("accepts valid baseline", () => {
    expect(() => BaselineSchema.parse(validBaseline)).not.toThrow();
  });

  it("rejects malformed marketDate", () => {
    expect(() =>
      BaselineSchema.parse({ ...validBaseline, marketDate: "20260802" })
    ).toThrow();
  });

  it("rejects missing stock entry", () => {
    expect(() =>
      BaselineSchema.parse({
        ...validBaseline,
        stocks: { samsung: validBaseline.stocks.samsung },
      })
    ).toThrow();
  });
});

describe("LatestDataSchema — schema version check", () => {
  const minimalSnapshot = {
    displayName: "삼성전자",
    koreanTicker: "005930",
    binanceSymbol: "SAMSUNGUSDT",
    krxClose: 100_000,
    baselineBinancePrice: 71.77,
    currentBinancePrice: 73.42,
    referencePriceMode: "mark",
    rawEstimatedPrice: 102_299.01,
    estimatedPrice: 102_500,
    changeAmount: 2_500,
    changeRate: 0.025,
    bidPrice: 73.4,
    askPrice: 73.44,
    spreadPercent: 0.0545,
    confidenceScore: 88,
    eventTime: "2026-08-02T11:29:58.000Z",
    status: "healthy",
  };

  const validLatest = {
    schemaVersion: 1,
    generatedAt: "2026-08-02T11:30:00.000Z",
    source: "binance-rest",
    stocks: { samsung: minimalSnapshot, skHynix: { ...minimalSnapshot, displayName: "SK하이닉스", koreanTicker: "000660", binanceSymbol: "SKHYNIXUSDT" } },
  };

  it("accepts schemaVersion 1", () => {
    expect(() => LatestDataSchema.parse(validLatest)).not.toThrow();
  });

  it("rejects schemaVersion other than 1", () => {
    expect(() => LatestDataSchema.parse({ ...validLatest, schemaVersion: 2 })).toThrow();
    expect(() => LatestDataSchema.parse({ ...validLatest, schemaVersion: 0 })).toThrow();
  });

  it("rejects unknown source", () => {
    expect(() =>
      LatestDataSchema.parse({ ...validLatest, source: "unknown-source" })
    ).toThrow();
  });

  it("accepts github-actions as source (written by GitHub Actions script)", () => {
    expect(() =>
      LatestDataSchema.parse({ ...validLatest, source: "github-actions" })
    ).not.toThrow();
  });

  it("accepts no-baseline snapshot with zero prices", () => {
    const noBaselineSnapshot = {
      ...minimalSnapshot,
      krxClose: 0,
      baselineBinancePrice: 0,
      currentBinancePrice: 0,
      rawEstimatedPrice: 0,
      estimatedPrice: 0,
      changeAmount: 0,
      changeRate: 0,
      status: "no-baseline",
    };
    const latest = {
      ...validLatest,
      stocks: {
        samsung: noBaselineSnapshot,
        skHynix: { ...noBaselineSnapshot, displayName: "SK하이닉스", koreanTicker: "000660", binanceSymbol: "SKHYNIXUSDT" },
      },
    };
    expect(() => LatestDataSchema.parse(latest)).not.toThrow();
  });
});

describe("HistoryArraySchema", () => {
  it("accepts valid history array", () => {
    const entry = {
      timestamp: "2026-08-02T11:30:00.000Z",
      stocks: {
        samsung: { estimatedPrice: 102_500, changeRate: 0.025, currentBinancePrice: 73.42, confidenceScore: 88 },
        skHynix: { estimatedPrice: 304_000, changeRate: 0.013, currentBinancePrice: 218.1, confidenceScore: 84 },
      },
    };
    expect(() => HistoryArraySchema.parse([entry])).not.toThrow();
  });

  it("accepts history entry with missing stock (partial data)", () => {
    const entry = {
      timestamp: "2026-08-02T11:30:00.000Z",
      stocks: {
        samsung: { estimatedPrice: 102_500, changeRate: 0.025, currentBinancePrice: 73.42, confidenceScore: 88 },
      },
    };
    expect(() => HistoryArraySchema.parse([entry])).not.toThrow();
  });

  it("accepts empty history array", () => {
    expect(() => HistoryArraySchema.parse([])).not.toThrow();
  });

  it("rejects history entry with invalid timestamp", () => {
    const entry = {
      timestamp: "not-a-date",
      stocks: {},
    };
    expect(() => HistoryArraySchema.parse([entry])).toThrow();
  });

  it("rejects history entry with negative estimatedPrice", () => {
    const entry = {
      timestamp: "2026-08-02T11:30:00.000Z",
      stocks: {
        samsung: { estimatedPrice: -1, changeRate: 0, currentBinancePrice: 73.42, confidenceScore: 88 },
      },
    };
    expect(() => HistoryArraySchema.parse([entry])).toThrow();
  });
});
