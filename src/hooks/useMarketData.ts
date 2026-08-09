import { useState, useCallback, useRef, useEffect } from "react";
import type { StockId, StockSnapshot } from "../types/market";
import { fetchStockQuote } from "../lib/binance/client";
import type { StockQuoteResult } from "../lib/binance/client";
import { calculateEstimate } from "../lib/calculateEstimate";
import { calculateConfidenceScore } from "../lib/confidenceScore";
import { fetchGithubLatest, fetchGithubBaseline } from "../lib/githubFallback";
import { fetchMarkPriceAtTime } from "../lib/binance/klinesClient";
import { resolveAnchor } from "../lib/marketSession";
import type { ResolvedAnchor } from "../lib/marketSession";
import { MARKET_SYMBOLS } from "../config/symbols";
import { useMinuteRefresh } from "./useMinuteRefresh";
import { connectBinanceFuturesStream } from "../lib/binance/websocketAdapter";
import type { WsConnectionStatus } from "../lib/binance/websocketAdapter";
import type { NormalizedQuote } from "../lib/binance/types";
import {
  MAX_CHANGE_RATE,
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

const STOCK_IDS: StockId[] = ["samsung", "skHynix"];

const DISPLAY: Record<StockId, { displayName: string; koreanTicker: string }> = {
  samsung: { displayName: "삼성전자", koreanTicker: "005930" },
  skHynix: { displayName: "SK하이닉스", koreanTicker: "000660" },
};

export function useMarketData(): MarketDataState {
  const [state, setState] = useState<MarketDataState>(INITIAL_STATE);
  const previousPrices = useRef<Partial<Record<StockId, number>>>({});
  const currentStocksRef = useRef<Partial<Record<StockId, StockSnapshot>>>({});
  currentStocksRef.current = state.stocks;

  // Latest WS bid/ask quotes keyed by Binance symbol (e.g. "SAMSUNGUSDT").
  // Written by the WS callback (no re-render), flushed to state at most once/s.
  const latestWsQuotesRef = useRef<Record<string, NormalizedQuote>>({});

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
        displayName: DISPLAY[stockId].displayName,
        koreanTicker: DISPLAY[stockId].koreanTicker,
        binanceSymbol: result.quote.symbol,
        currentBinancePrice: result.referencePrice,
        referencePriceMode: mode,
        bidPrice: bid,
        askPrice: ask,
        eventTime: result.quote.eventTime,
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

  // WebSocket connection for real-time bid/ask updates (bid/ask only — markPrice
  // is not emitted via WS for TradFi symbols; estimate recalculation stays on
  // the 60s REST refresh path to preserve anchor-based outlier protection).
  useEffect(() => {
    const symbols = STOCK_IDS.map((id) => MARKET_SYMBOLS[id].binanceSymbol);

    const disconnect = connectBinanceFuturesStream(
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

          if (bid !== existing.bidPrice || ask !== existing.askPrice) {
            updated[id] = {
              ...existing,
              bidPrice: bid,
              askPrice: ask,
              spreadPercent,
              eventTime: quote!.eventTime,
            };
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
