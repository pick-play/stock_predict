import { useState, useCallback, useRef, useEffect } from "react";
import type { StockId, StockSnapshot } from "../types/market";
import { fetchStockQuote, fetchBookQuotes } from "../lib/binance/client";
import type { StockQuoteResult } from "../lib/binance/client";
import { calculateEstimate } from "../lib/calculateEstimate";
import { calculateConfidenceScore } from "../lib/confidenceScore";
import { fetchGithubLatest, fetchGithubBaseline } from "../lib/githubFallback";
import { fetchMarkPriceAtTime } from "../lib/binance/klinesClient";
import { resolveAnchor } from "../lib/marketSession";
import type { ResolvedAnchor } from "../lib/marketSession";
import { MARKET_SYMBOLS, STOCK_IDS } from "../config/symbols";
import { useMinuteRefresh } from "./useMinuteRefresh";
import { connectBinanceFuturesStream } from "../lib/binance/websocketAdapter";
import type { WsConnectionStatus } from "../lib/binance/websocketAdapter";
import type { NormalizedQuote } from "../lib/binance/types";
import { prefersPolledFeed } from "../lib/liveFeedMode";
import {
  MAX_CHANGE_RATE,
  MOBILE_QUOTE_POLL_INTERVAL_MS,
  MIN_PRICE_RATIO,
  MAX_PRICE_RATIO,
} from "../config/market";

export interface MarketDataState {
  stocks: Partial<Record<StockId, StockSnapshot>>;
  lastUpdated: string | null;
  error: string | null;
  isLoading: boolean;
  usingFallback: boolean;
  anchor: ResolvedAnchor | null;
  wsStatus: WsConnectionStatus;
}

const INITIAL_STATE: MarketDataState = {
  stocks: {},
  lastUpdated: null,
  error: null,
  isLoading: true,
  usingFallback: false,
  anchor: null,
  wsStatus: "connecting",
};

/**
 * The later of two ISO timestamps, tolerating nulls and unparseable input.
 *
 * A quote's eventTime is what the card measures staleness from, and it must
 * never move backwards. Two of the listed symbols are quoted thinly enough that
 * their bookTicker timestamps demonstrably do: NAVERUSDT's sat ten minutes old
 * without advancing across a 46-second sample, and HANMIUSDT's went backwards
 * between consecutive reads. Their *prices* were fine — nobody was quoting into
 * the book, that is all — but a card that announces 업데이트 중단 over a healthy
 * price teaches its reader to stop believing the indicator.
 *
 * The mark price is the feed that keeps ticking (426–1322 ms old on those same
 * two symbols while their books were frozen), and the once-a-minute refresh
 * already dates its quotes from premiumIndex.time. So the rule is: take the
 * newest timestamp anyone has seen for this symbol, which lets a live book
 * advance freshness second by second while the minute refresh guarantees a
 * floor of ~60s for a symbol whose book has gone quiet.
 */
function laterIso(a: string | null | undefined, b: string): string {
  if (!a) return b;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta)) return b;
  if (!Number.isFinite(tb)) return a;
  return tb > ta ? b : a;
}

export function useMarketData(): MarketDataState {
  const [state, setState] = useState<MarketDataState>(INITIAL_STATE);
  const previousPrices = useRef<Partial<Record<StockId, number>>>({});
  const currentStocksRef = useRef<Partial<Record<StockId, StockSnapshot>>>({});
  currentStocksRef.current = state.stocks;

  // Latest WS bid/ask quotes keyed by Binance symbol (e.g. "SAMSUNGUSDT").
  // Written by the WS callback (no re-render), flushed to state at most once/s.
  const latestWsQuotesRef = useRef<Record<string, NormalizedQuote>>({});

  // Gap between the REST mark price and the book mid at the same moment. Only
  // the book streams live, so live ticks are quoted as mid + this offset to
  // stay on the same scale as the anchor, which is a mark price.
  const markMidOffsetRef = useRef<Partial<Record<StockId, number>>>({});

  const refresh = useCallback(async () => {
    const baseline = await fetchGithubBaseline();

    // Which KRX price the estimate is measured from: today's open while the
    // market is trading, the last close otherwise.
    const anchor = resolveAnchor(baseline);

    // The futures price at that same instant. Actions cannot reach Binance
    // (HTTP 451 from US runners), so the browser reads it from klines.
    const anchorSettled = anchor
      ? await Promise.allSettled(
          STOCK_IDS.map((id) =>
            fetchMarkPriceAtTime(
              MARKET_SYMBOLS[id].binanceSymbol,
              anchor.anchorTimeMs
            )
          )
        )
      : [];
    const anchorFutures: Partial<Record<StockId, number>> = {};
    anchorSettled.forEach((result, i) => {
      const price = result.status === "fulfilled" ? result.value : null;
      if (price !== null && price > 0) anchorFutures[STOCK_IDS[i]] = price;
    });

    const mode = baseline?.referencePriceMode ?? "mark";
    const quoteSettled = await Promise.allSettled(
      STOCK_IDS.map((id) => fetchStockQuote(id, mode))
    );

    const quoteResults: Record<StockId, StockQuoteResult> = {} as Record<
      StockId,
      StockQuoteResult
    >;
    quoteSettled.forEach((result, i) => {
      const id = STOCK_IDS[i];
      quoteResults[id] =
        result.status === "fulfilled"
          ? result.value
          : {
              stockId: id,
              quote: null,
              referencePrice: null,
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            };
    });

    const newStocks: Partial<Record<StockId, StockSnapshot>> = {
      ...currentStocksRef.current,
    };

    for (const stockId of STOCK_IDS) {
      const result = quoteResults[stockId];
      if (result.error || !result.quote || !result.referencePrice) continue;

      const anchorKrxPrice = anchor?.krxPrice[stockId];
      const anchorFuturesPrice = anchorFutures[stockId];

      // Merge latest WS bid/ask if available — fresher than the REST bookTicker response.
      const wsQuote = latestWsQuotesRef.current[result.quote.symbol];
      const bid = wsQuote?.bidPrice ?? result.quote.bidPrice;
      const ask = wsQuote?.askPrice ?? result.quote.askPrice;

      const base = {
        displayName: MARKET_SYMBOLS[stockId].displayName,
        koreanTicker: MARKET_SYMBOLS[stockId].koreanTicker,
        binanceSymbol: result.quote.symbol,
        currentBinancePrice: result.referencePrice,
        referencePriceMode: mode,
        bidPrice: bid,
        askPrice: ask,
        // Dated by premiumIndex.time (see normalizeFuturesTicker), the one field
        // in this payload that keeps ticking on a thinly quoted symbol.
        eventTime: laterIso(
          currentStocksRef.current[stockId]?.eventTime,
          result.quote.eventTime
        ),
      };

      // Without both halves of the anchor there is no honest estimate to show.
      if (!anchor || !(anchorKrxPrice! > 0) || !(anchorFuturesPrice! > 0)) {
        newStocks[stockId] = {
          ...base,
          krxClose: 0,
          baselineBinancePrice: 0,
          rawEstimatedPrice: 0,
          estimatedPrice: 0,
          changeAmount: 0,
          changeRate: 0,
          spreadPercent: null,
          confidenceScore: calculateConfidenceScore({
            quote: result.quote,
            hasAnchor: false,
            anchorTimeMs: null,
            usingFallback: false,
          }),
          status: "no-baseline",
        };
        continue;
      }

      const currentPrice = result.referencePrice;
      const prevPrice = previousPrices.current[stockId];

      if (prevPrice !== undefined && prevPrice > 0) {
        const ratio = currentPrice / prevPrice;
        if (ratio < MIN_PRICE_RATIO || ratio > MAX_PRICE_RATIO) {
          console.warn(
            `[useMarketData] Outlier price for ${stockId}: prev=${prevPrice} curr=${currentPrice}`
          );
          continue;
        }
        const changeFromAnchor = Math.abs(currentPrice / anchorFuturesPrice! - 1);
        if (changeFromAnchor > MAX_CHANGE_RATE) {
          console.warn(
            `[useMarketData] Large change rate for ${stockId}: ${changeFromAnchor}`
          );
        }
      }

      try {
        const estimate = calculateEstimate({
          krxClose: anchorKrxPrice!,
          currentBinancePrice: currentPrice,
          baselineBinancePrice: anchorFuturesPrice!,
        });

        const spreadPercent =
          bid !== null && ask !== null && bid > 0 && ask > 0
            ? ((ask - bid) / ask) * 100
            : null;

        if (bid !== null && ask !== null && bid > 0 && ask > 0 && bid <= ask) {
          markMidOffsetRef.current[stockId] = currentPrice - (bid + ask) / 2;
        }

        newStocks[stockId] = {
          ...base,
          krxClose: anchorKrxPrice!,
          baselineBinancePrice: anchorFuturesPrice!,
          ...estimate,
          spreadPercent,
          confidenceScore: calculateConfidenceScore({
            quote: result.quote,
            hasAnchor: true,
            anchorTimeMs: anchor.anchorTimeMs,
            usingFallback: false,
          }),
          status: "healthy",
          anchorKind: anchor.kind,
          anchorMarketDate: anchor.marketDate,
        };

        previousPrices.current[stockId] = currentPrice;
      } catch (err) {
        console.error(`[useMarketData] Estimate error for ${stockId}:`, err);
      }
    }

    // Every quote failed and nothing was shown before: fall back to the stored
    // snapshot so the cards still render instead of leaving the page blank.
    if (Object.keys(newStocks).length === 0) {
      const fallback = await fetchGithubLatest();
      if (fallback) {
        setState((prev) => ({
          ...prev,
          stocks: fallback.stocks as Partial<Record<StockId, StockSnapshot>>,
          lastUpdated: fallback.generatedAt,
          usingFallback: true,
          isLoading: false,
          anchor,
          error:
            "선물가격 데이터를 조회할 수 없습니다. 저장된 데이터를 표시합니다.",
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        anchor,
        error: "선물가격 데이터를 조회할 수 없습니다. 데이터 확인 중입니다.",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      stocks: newStocks,
      lastUpdated: new Date().toISOString(),
      error: null,
      isLoading: false,
      usingFallback: false,
      anchor,
    }));
  }, []);

  useMinuteRefresh(refresh);

  /*
   * Live prices, by one of two routes.
   *
   * Desktop streams the order book. Probing the futures socket showed markPrice,
   * ticker and aggTrade emit nothing for these symbols, so bookTicker is the only
   * stream available; the estimate is repriced from its mid once per second while
   * REST keeps supplying the authoritative mark.
   *
   * A phone polls REST instead. That stream costs 103.8 frames a second — about
   * 78 MB an hour and a hundred JSON parses a second — and a modem fed that never
   * idles, which is what made the page warm to hold. One read every four seconds
   * carries the same number to a reader who is checking a price.
   *
   * That poll is a single all-symbols bookTicker request, not one per stock, so
   * its cost does not grow when a stock is added. See fetchBookQuotes.
   *
   * Both routes end in the same place: a NormalizedQuote in latestWsQuotesRef,
   * flushed and repriced by the one timer below. Only the delivery differs, so
   * the estimate cannot drift between a phone and a desktop.
   */
  useEffect(() => {
    const symbols = STOCK_IDS.map((id) => MARKET_SYMBOLS[id].binanceSymbol);
    const polled = prefersPolledFeed();

    let disconnect: () => void;

    if (polled) {
      const poll = async () => {
        // Hidden tab: nothing to update and every request keeps the radio awake.
        if (document.visibilityState !== "visible") return;

        // One request for every listed stock, not one each.
        const { quotes } = await fetchBookQuotes(STOCK_IDS);

        let anySucceeded = false;
        for (const id of STOCK_IDS) {
          const quote = quotes[id];
          if (!quote) continue;
          latestWsQuotesRef.current[quote.symbol] = quote;
          anySucceeded = true;
        }

        /*
         * wsStatus is what the card consults before it claims 실시간, so it has
         * to mean "the live feed is working" rather than "a socket is open".
         * A poll that answered is exactly as live as a socket that ticked.
         */
        setState((prev) => ({
          ...prev,
          wsStatus: anySucceeded ? "connected" : "disconnected",
        }));
      };

      void poll();
      const pollTimer = window.setInterval(
        () => void poll(),
        MOBILE_QUOTE_POLL_INTERVAL_MS
      );
      // Coming back to the tab should not wait out the interval.
      const onVisible = () => {
        if (document.visibilityState === "visible") void poll();
      };
      document.addEventListener("visibilitychange", onVisible);

      disconnect = () => {
        window.clearInterval(pollTimer);
        document.removeEventListener("visibilitychange", onVisible);
      };
    } else {
      disconnect = connectBinanceFuturesStream(
        symbols,
        (quote) => {
          // Store in ref only — no setState here. The 1s flush timer below
          // batches these into a single setState, preventing multiple re-renders/s.
          latestWsQuotesRef.current[quote.symbol] = quote;
        },
        (status) => {
          setState((prev) => ({ ...prev, wsStatus: status }));
        }
      );
    }

    // Flush pending WS bid/ask quotes to state at most once per second.
    // Tab visibility guard: skip flush when hidden to avoid waking up React.
    const flushTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      // Snapshot and clear atomically so WS messages arriving mid-flush
      // land in the next batch rather than being dropped.
      const pending = latestWsQuotesRef.current;
      latestWsQuotesRef.current = {};

      const entries = STOCK_IDS.map((id) => ({
        id,
        symbol: MARKET_SYMBOLS[id].binanceSymbol,
        quote: pending[MARKET_SYMBOLS[id].binanceSymbol],
      })).filter(({ quote }) => quote !== undefined);

      if (entries.length === 0) return;

      setState((prev) => {
        const updated: Partial<Record<StockId, StockSnapshot>> = {
          ...prev.stocks,
        };
        let changed = false;

        for (const { id, quote } of entries) {
          const existing = updated[id];
          if (!existing) continue;

          const bid = quote!.bidPrice;
          const ask = quote!.askPrice;
          if (bid === null || ask === null) continue;
          // Discard inverted book (bid > ask is a data error)
          if (bid > ask) continue;

          const spreadPercent =
            bid > 0 && ask > 0
              ? ((ask - bid) / ask) * 100
              : existing.spreadPercent;

          const next: StockSnapshot = {
            ...existing,
            bidPrice: bid,
            askPrice: ask,
            spreadPercent,
            // Never let a stale or rewound book timestamp age the card past what
            // the mark price already proved. See laterIso.
            eventTime: laterIso(existing.eventTime, quote!.eventTime),
          };

          // Reprice from the live book when the anchor is known. Without it the
          // card is already showing "기준가격 갱신 필요" and must not start
          // displaying a number.
          if (
            existing.status === "healthy" &&
            existing.krxClose > 0 &&
            existing.baselineBinancePrice > 0 &&
            bid > 0 &&
            ask > 0
          ) {
            const live =
              (bid + ask) / 2 + (markMidOffsetRef.current[id] ?? 0);
            const ratio = live / existing.currentBinancePrice;

            if (live > 0 && ratio >= MIN_PRICE_RATIO && ratio <= MAX_PRICE_RATIO) {
              try {
                Object.assign(
                  next,
                  calculateEstimate({
                    krxClose: existing.krxClose,
                    currentBinancePrice: live,
                    baselineBinancePrice: existing.baselineBinancePrice,
                  })
                );
                next.currentBinancePrice = live;
              } catch {
                // Keep the last good numbers rather than blanking the card.
              }
            }
          }

          if (
            next.bidPrice !== existing.bidPrice ||
            next.askPrice !== existing.askPrice ||
            next.estimatedPrice !== existing.estimatedPrice
          ) {
            updated[id] = next;
            changed = true;
          }
        }

        if (!changed) return prev;
        return { ...prev, stocks: updated };
      });
    }, 1000);

    return () => {
      disconnect();
      window.clearInterval(flushTimer);
    };
  }, []);

  return state;
}
