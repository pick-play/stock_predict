/**
 * The live poll must cost one HTTP request, whatever the site lists.
 *
 * The per-symbol form this replaced fired three requests per stock. At two
 * stocks that was six every four seconds and nobody noticed; at seven it is
 * twenty-one, or 18,900 an hour from a single phone, and Binance's per-IP budget
 * is spent in request *weight* — 28 per poll, 420 a minute, against a ceiling of
 * 2400. Five or six readers behind one office or CGNAT address and the API
 * starts answering 429 for all of them.
 *
 * The all-symbols form costs weight 5 and one request no matter how long the
 * listing grows. That invariance is the entire point of the change and it is
 * exactly the kind of thing that regresses silently later — someone adds a
 * field, reaches for the convenient per-symbol call inside a loop, and the tests
 * still pass because every individual quote is still correct. So the count is
 * asserted here directly, parameterised over listing size.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FuturesAdapter } from "../binance/tradFiAdapter";
import { fetchBookQuotes } from "../binance/client";
import { MARKET_SYMBOLS, STOCK_IDS } from "../../config/symbols";
import type { StockId } from "../../types/market";

/**
 * Read through the same config the code under test uses, so adding a stock
 * extends this test rather than breaking it.
 */
function symbolFor(id: StockId): string {
  return MARKET_SYMBOLS[id].binanceSymbol;
}

const BASE = "https://fapi.example.test";

/** A bookTicker row as fapi returns it, plus the noise of 700-odd other symbols. */
function row(symbol: string, bid: number, ask: number, time = Date.now()) {
  return {
    symbol,
    bidPrice: bid.toFixed(2),
    bidQty: "1.0",
    askPrice: ask.toFixed(2),
    askQty: "1.0",
    time,
    lastUpdateId: 1,
  };
}

function allSymbolsPayload(extra: ReturnType<typeof row>[] = []) {
  const noise = ["BTCUSDT", "ETHUSDT", "QQQUSDT", "XPTUSDT"].map((s) =>
    row(s, 100, 100.1)
  );
  return [...noise, ...extra];
}

function stubFetch(payload: unknown, ok = true, status = 200) {
  // Typed with the url param so `mock.calls[0][0]` is reachable in the
  // assertion that the request carries no symbol filter.
  const fetchMock = vi.fn(async (url: string) => {
    void url;
    return { ok, status, json: async () => payload };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("batched bookTicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["two stocks", ["SAMSUNGUSDT", "SKHYNIXUSDT"]],
    [
      "seven stocks",
      [
        "SAMSUNGUSDT",
        "SKHYNIXUSDT",
        "HYUNDAIUSDT",
        "SAMSUNGEMUSDT",
        "LGELECTRONICSUSDT",
        "HANMIUSDT",
        "NAVERUSDT",
      ],
    ],
    [
      "thirty stocks",
      Array.from({ length: 30 }, (_, i) => `FAKE${i}USDT`),
    ],
  ])("issues exactly one request for %s", async (_label, symbols) => {
    const fetchMock = stubFetch(
      allSymbolsPayload(symbols.map((s, i) => row(s, 70 + i, 70.1 + i)))
    );

    const adapter = new FuturesAdapter(BASE);
    const quotes = await adapter.fetchBookTickers(symbols);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(quotes.size).toBe(symbols.length);
  });

  it("asks for every symbol at once, with no symbol filter in the URL", async () => {
    const fetchMock = stubFetch(
      allSymbolsPayload([row("SAMSUNGUSDT", 70, 70.1)])
    );

    await new FuturesAdapter(BASE).fetchBookTickers(["SAMSUNGUSDT"]);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toBe(`${BASE}/fapi/v1/ticker/bookTicker`);
    // fapi accepts `symbols=` and ignores it, so asking would only mislead the
    // next reader into thinking the response is already filtered.
    expect(url).not.toContain("symbol");
  });

  it("keeps only the symbols asked for", async () => {
    stubFetch(allSymbolsPayload([row("SAMSUNGUSDT", 70, 70.1)]));

    const quotes = await new FuturesAdapter(BASE).fetchBookTickers([
      "SAMSUNGUSDT",
    ]);

    expect([...quotes.keys()]).toEqual(["SAMSUNGUSDT"]);
    expect(quotes.get("SAMSUNGUSDT")).toMatchObject({
      bidPrice: 70,
      askPrice: 70.1,
      // Bid/ask only — the same shape the desktop socket delivers, so neither
      // feed can hand the repricing code something the other cannot.
      markPrice: null,
      lastPrice: null,
    });
  });

  it("drops an inverted book rather than quoting a negative spread", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch(allSymbolsPayload([row("SAMSUNGUSDT", 70.5, 70.1)]));

    const quotes = await new FuturesAdapter(BASE).fetchBookTickers([
      "SAMSUNGUSDT",
    ]);

    expect(quotes.has("SAMSUNGUSDT")).toBe(false);
  });

  it("omits a symbol missing from the response instead of inventing one", async () => {
    stubFetch(allSymbolsPayload([row("SAMSUNGUSDT", 70, 70.1)]));

    const quotes = await new FuturesAdapter(BASE).fetchBookTickers([
      "SAMSUNGUSDT",
      "NEWLYLISTEDUSDT",
    ]);

    expect(quotes.has("SAMSUNGUSDT")).toBe(true);
    expect(quotes.has("NEWLYLISTEDUSDT")).toBe(false);
  });

  it("makes no request at all when asked for nothing", async () => {
    const fetchMock = stubFetch(allSymbolsPayload());

    const quotes = await new FuturesAdapter(BASE).fetchBookTickers([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(quotes.size).toBe(0);
  });
});

describe("fetchBookQuotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("covers every configured stock in one request", async () => {
    const fetchMock = stubFetch(
      allSymbolsPayload(
        STOCK_IDS.map((id, i) => row(symbolFor(id), 70 + i, 70.1 + i))
      )
    );

    const { quotes, error } = await fetchBookQuotes();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeNull();
    expect(Object.keys(quotes).sort()).toEqual([...STOCK_IDS].sort());
  });

  /*
   * A batched read fails all-or-nothing where the per-symbol one could fail for
   * one stock alone. Either way the contract is the same: report the failure and
   * hand back nothing, so the caller keeps the prices it already has. A blanked
   * card is a worse lie than a card that admits it is a minute behind.
   */
  it("reports a transport failure without throwing or fabricating quotes", async () => {
    stubFetch(null, false, 503);

    const { quotes, error } = await fetchBookQuotes();

    expect(error).toMatch(/503/);
    expect(Object.keys(quotes)).toHaveLength(0);
  });

  it("survives a response that is not an array", async () => {
    stubFetch({ code: -1121, msg: "Invalid symbol." });

    const { quotes, error } = await fetchBookQuotes();

    expect(error).toBeTruthy();
    expect(Object.keys(quotes)).toHaveLength(0);
  });
});
