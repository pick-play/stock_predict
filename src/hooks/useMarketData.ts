import { useState, useCallback, useRef } from "react";
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
}

const INITIAL_STATE: MarketDataState = {
  stocks: {},
  lastUpdated: null,
  error: null,
  isLoading: true,
  usingFallback: false,
  anchor: null,
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
      const base = {
        displayName: DISPLAY[stockId].displayName,
        koreanTicker: DISPLAY[stockId].koreanTicker,
        binanceSymbol: result.quote.symbol,
        currentBinancePrice: result.referencePrice,
        referencePriceMode: mode,
        bidPrice: result.quote.bidPrice,
        askPrice: result.quote.askPrice,
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

        const bid = result.quote.bidPrice;
        const ask = result.quote.askPrice;
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

    setState({
      stocks: newStocks,
      lastUpdated: new Date().toISOString(),
      error: null,
      isLoading: false,
      usingFallback: false,
      anchor,
    });
  }, []);

  useMinuteRefresh(refresh);

  return state;
}
