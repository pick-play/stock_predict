import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchGithubLatest, fetchGithubHistory } from "../githubFallback";
import { FALLBACK_MAX_AGE_MS } from "../../config/market";

const NOW = new Date("2026-08-10T12:00:00.000Z");

function snapshot(overrides: Record<string, unknown> = {}) {
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
    eventTime: "2026-08-10T11:59:00.000Z",
    rawEstimatedPrice: 208200.5,
    estimatedPrice: 208000,
    changeAmount: -22000,
    changeRate: -0.0948,
    status: "healthy",
    ...overrides,
  };
}

function latestPayload(generatedAt: string) {
  return {
    schemaVersion: 1,
    generatedAt,
    source: "github-actions",
    stocks: {
      samsung: snapshot(),
      skHynix: snapshot({
        displayName: "SK하이닉스",
        koreanTicker: "000660",
        binanceSymbol: "SKHYNIXUSDT",
      }),
    },
  };
}

function mockJson(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    })
  );
}

describe("fetchGithubLatest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the snapshot when it is fresh enough to stand in for a live price", async () => {
    const generatedAt = new Date(NOW.getTime() - 60_000).toISOString();
    mockJson(latestPayload(generatedAt));

    const result = await fetchGithubLatest();

    expect(result).not.toBeNull();
    expect(result?.generatedAt).toBe(generatedAt);
  });

  it("accepts a snapshot just inside the age limit", async () => {
    const generatedAt = new Date(
      NOW.getTime() - (FALLBACK_MAX_AGE_MS - 1_000)
    ).toISOString();
    mockJson(latestPayload(generatedAt));

    expect(await fetchGithubLatest()).not.toBeNull();
  });

  it("rejects a snapshot past the age limit", async () => {
    const generatedAt = new Date(
      NOW.getTime() - (FALLBACK_MAX_AGE_MS + 1_000)
    ).toISOString();
    mockJson(latestPayload(generatedAt));

    expect(await fetchGithubLatest()).toBeNull();
  });

  // The regression this guard exists for: the scheduled writer is disabled, so
  // the committed snapshot ages indefinitely and was being shown as current.
  it("rejects a snapshot that is days old", async () => {
    mockJson(latestPayload("2026-08-02T13:35:50.270Z"));

    expect(await fetchGithubLatest()).toBeNull();
  });

  it("rejects a snapshot dated far in the future", async () => {
    const generatedAt = new Date(
      NOW.getTime() + FALLBACK_MAX_AGE_MS * 2
    ).toISOString();
    mockJson(latestPayload(generatedAt));

    expect(await fetchGithubLatest()).toBeNull();
  });
});

describe("fetchGithubHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const point = (estimatedPrice: number) => ({
    estimatedPrice,
    changeRate: 0.01,
    currentBinancePrice: 165.31,
    confidenceScore: 90,
  });

  it("keeps entries that carry a real price", async () => {
    mockJson([
      {
        timestamp: "2026-08-10T11:00:00.000Z",
        stocks: { samsung: point(230000), skHynix: point(1420000) },
      },
    ]);

    const result = await fetchGithubHistory();

    expect(result).toHaveLength(1);
    expect(Object.keys(result![0].stocks)).toEqual(["samsung", "skHynix"]);
  });

  it("drops an entry whose every stock is priced at zero", async () => {
    mockJson([
      {
        timestamp: "2026-08-02T11:30:00.000Z",
        stocks: { samsung: point(0), skHynix: point(0) },
      },
      {
        timestamp: "2026-08-10T11:00:00.000Z",
        stocks: { samsung: point(230000), skHynix: point(1420000) },
      },
    ]);

    const result = await fetchGithubHistory();

    expect(result).toHaveLength(1);
    expect(result![0].timestamp).toBe("2026-08-10T11:00:00.000Z");
  });

  it("drops only the zero-priced stock from a partially valid entry", async () => {
    mockJson([
      {
        timestamp: "2026-08-10T11:00:00.000Z",
        stocks: { samsung: point(230000), skHynix: point(0) },
      },
    ]);

    const result = await fetchGithubHistory();

    expect(result).toHaveLength(1);
    expect(Object.keys(result![0].stocks)).toEqual(["samsung"]);
  });

  it("returns an empty array when nothing survives cleaning", async () => {
    mockJson([
      {
        timestamp: "2026-08-02T11:30:00.000Z",
        stocks: { samsung: point(0), skHynix: point(0) },
      },
    ]);

    expect(await fetchGithubHistory()).toEqual([]);
  });
});
