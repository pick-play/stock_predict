import { useState, useCallback, useRef } from "react";
import type { StockId, StockSnapshot } from "../types/market";
import { fetchStockQuote } from "../lib/binance/client";
import type { StockQuoteResult } from "../lib/binance/client";
import { calculateEstimate } from "../lib/calculateEstimate";
import { calculateConfidenceScore } from "../lib/confidenceScore";
import { fetchGithubLatest, fetchGithubBaseline } from "../lib/githubFallback";
import { fetchMarkPriceAtTime } from "../lib/binance/klinesClient";
import { getLastKrxCloseMs } from "../lib/koreaMarket";
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
}

const INITIAL_STATE: MarketDataState = {
  stocks: {},
  lastUpdated: null,
  error: null,
  isLoading: true,
  usingFallback: false,
};


export function useMarketData(): MarketDataState {
  const [state, setState] = useState<MarketDataState>(INITIAL_STATE);
  const previousPrices = useRef<Partial<Record<StockId, number>>>({});
  const currentStocksRef = useRef<Partial<Record<StockId, StockSnapshot>>>({});
  currentStocksRef.current = state.stocks;

  const refresh = useCallback(async () => {
    // Fetch baseline first so we know each stock's referencePriceMode (fixes M1/M3)
    const baseline = await fetchGithubBaseline();

    // Determine the last KRX close time and fetch Binance mark prices at that
    // exact moment via klines.  This gives a session-accurate anchor even when
    // baseline.json has not yet been refreshed by GitHub Actions.
    const lastKrxCloseMs = getLastKrxCloseMs();
    const stockIds: StockId[] = ["samsung", "skHynix"];

    const klinesSettled = await Promise.allSettled(
      stockIds.map((id) =>
        fetchMarkPriceAtTime(MARKET_SYMBOLS[id].binanceSymbol, lastKrxCloseMs)
      )
    );
    const klinesAnchor: Partial<Record<StockId, number | null>> = {};
    klinesSettled.forEach((result, i) => {
      const id = stockIds[i];
      klinesAnchor[id] = result.status === "fulfilled" ? result.value : null;
    });

    // Per-stock quote fetch using each stock's configured referencePriceMode.
    // Default "last" — TradFi spot products have no markPrice.
    const quoteSettled = await Promise.allSettled(
      stockIds.map((id) =>
        fetchStockQuote(id, baseline?.stocks[id]?.referencePriceMode ?? "last")
      )
    );

    const quoteResults: Record<StockId, StockQuoteResult> = {} as Record<
      StockId,
      StockQuoteResult
    >;
    quoteSettled.forEach((result, i) => {
      const id = stockIds[i];
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

    for (const stockId of stockIds) {
      const result = quoteResults[stockId];
      const baselineStock = baseline?.stocks[stockId] ?? null;

      if (result.error || !result.quote || !result.referencePrice) {
        continue;
      }

      if (!baselineStock) {
        const conf = calculateConfidenceScore({
          quote: result.quote,
          baseline: null,
          baselineDate: null,
          usingFallback: false,
        });
        newStocks[stockId] = {
          displayName: stockId === "samsung" ? "삼성전자" : "SK하이닉스",
          koreanTicker: stockId === "samsung" ? "005930" : "000660",
          binanceSymbol: result.quote.symbol,
          krxClose: 0,
          baselineBinancePrice: 0,
          currentBinancePrice: result.referencePrice,
          referencePriceMode: baseline?.stocks[stockId]?.referencePriceMode ?? "last",
          rawEstimatedPrice: 0,
          estimatedPrice: 0,
          changeAmount: 0,
          changeRate: 0,
          bidPrice: result.quote.bidPrice,
          askPrice: result.quote.askPrice,
          spreadPercent: null,
          confidenceScore: conf,
          eventTime: result.quote.eventTime,
          status: "no-baseline",
        };
        continue;
      }

      const prevPrice = previousPrices.current[stockId];
      const currentPrice = result.referencePrice;

      // Prefer the klines-fetched anchor (mark price at exact KRX close time).
      // Fall back to baseline.json's stored reference price if klines fail.
      const klinesPrice = klinesAnchor[stockId] ?? null;
      const anchorBinancePrice =
        klinesPrice !== null && klinesPrice > 0
          ? klinesPrice
          : baselineStock.binanceReferencePrice;

      if (prevPrice !== undefined && prevPrice > 0) {
        const ratio = currentPrice / prevPrice;
        if (ratio < MIN_PRICE_RATIO || ratio > MAX_PRICE_RATIO) {
          console.warn(
            `[useMarketData] Outlier price for ${stockId}: prev=${prevPrice} curr=${currentPrice}`
          );
          continue;
        }
        const changeFromBaseline =
          Math.abs(currentPrice / anchorBinancePrice - 1);
        if (changeFromBaseline > MAX_CHANGE_RATE) {
          console.warn(
            `[useMarketData] Large change rate for ${stockId}: ${changeFromBaseline}`
          );
        }
      }

      try {
        const estimate = calculateEstimate({
          krxClose: baselineStock.krxClose,
          currentBinancePrice: currentPrice,
          baselineBinancePrice: anchorBinancePrice,
        });

        const bid = result.quote.bidPrice;
        const ask = result.quote.askPrice;
        const spreadPercent =
          bid !== null && ask !== null && bid > 0 && ask > 0
            ? ((ask - bid) / ask) * 100
            : null;

        const conf = calculateConfidenceScore({
          quote: result.quote,
          baseline: baselineStock,
          baselineDate: baseline?.capturedAt ?? null,
          usingFallback: false,
        });

        newStocks[stockId] = {
          displayName: stockId === "samsung" ? "삼성전자" : "SK하이닉스",
          koreanTicker: stockId === "samsung" ? "005930" : "000660",
          binanceSymbol: result.quote.symbol,
          krxClose: baselineStock.krxClose,
          baselineBinancePrice: anchorBinancePrice,
          currentBinancePrice: currentPrice,
          referencePriceMode: baselineStock.referencePriceMode,
          ...estimate,
          bidPrice: bid,
          askPrice: ask,
          spreadPercent,
          confidenceScore: conf,
          eventTime: result.quote.eventTime,
          status: "healthy",
        };

        previousPrices.current[stockId] = currentPrice;
      } catch (err) {
        console.error(`[useMarketData] Estimate error for ${stockId}:`, err);
      }
    }

    // C2 fix: if all quotes failed and there is no prior state to show,
    // fall back to GitHub latest.json so cards render as "no-baseline" / "error"
    // rather than leaving the page blank.
    if (Object.keys(newStocks).length === 0) {
      const fallback = await fetchGithubLatest();
      if (fallback) {
        setState((prev) => ({
          ...prev,
          stocks: fallback.stocks as Partial<Record<StockId, StockSnapshot>>,
          lastUpdated: fallback.generatedAt,
          usingFallback: true,
          isLoading: false,
          error:
            "선물가격 데이터를 조회할 수 없습니다. GitHub 저장 데이터를 표시합니다.",
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
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
    });
  }, []);

  useMinuteRefresh(refresh);

  return state;
}
