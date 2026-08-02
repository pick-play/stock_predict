import { useState, useCallback, useRef } from "react";
import type { StockId, StockSnapshot, Baseline, LatestData } from "../types/market";
import { fetchStockQuote } from "../lib/binance/client";
import type { StockQuoteResult } from "../lib/binance/client";
import { calculateEstimate } from "../lib/calculateEstimate";
import { calculateConfidenceScore } from "../lib/confidenceScore";
import { BaselineSchema, LatestDataSchema } from "../lib/validation";
import { useMinuteRefresh } from "./useMinuteRefresh";
import {
  BASELINE_PATH,
  LATEST_PATH,
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

async function fetchBaseline(): Promise<Baseline | null> {
  try {
    const res = await fetch(`${BASELINE_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const result = BaselineSchema.safeParse(json);
    if (!result.success) {
      console.error("[useMarketData] Invalid baseline:", result.error);
      return null;
    }
    return result.data as Baseline;
  } catch {
    return null;
  }
}

async function fetchGithubLatest(): Promise<LatestData | null> {
  try {
    const res = await fetch(`${LATEST_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const result = LatestDataSchema.safeParse(json);
    if (!result.success) return null;
    return result.data as LatestData;
  } catch {
    return null;
  }
}

export function useMarketData(): MarketDataState {
  const [state, setState] = useState<MarketDataState>(INITIAL_STATE);
  const previousPrices = useRef<Partial<Record<StockId, number>>>({});
  const currentStocksRef = useRef<Partial<Record<StockId, StockSnapshot>>>({});
  currentStocksRef.current = state.stocks;

  const refresh = useCallback(async () => {
    // Fetch baseline first so we know each stock's referencePriceMode (fixes M1/M3)
    const baseline = await fetchBaseline();

    // Per-stock quote fetch using each stock's configured referencePriceMode.
    // Default "last" — TradFi spot products have no markPrice.
    const stockIds: StockId[] = ["samsung", "skHynix"];
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

      if (prevPrice !== undefined && prevPrice > 0) {
        const ratio = currentPrice / prevPrice;
        if (ratio < MIN_PRICE_RATIO || ratio > MAX_PRICE_RATIO) {
          console.warn(
            `[useMarketData] Outlier price for ${stockId}: prev=${prevPrice} curr=${currentPrice}`
          );
          continue;
        }
        const changeFromBaseline =
          Math.abs(currentPrice / baselineStock.binanceReferencePrice - 1);
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
          baselineBinancePrice: baselineStock.binanceReferencePrice,
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
          baselineBinancePrice: baselineStock.binanceReferencePrice,
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
            "바이낸스 심볼을 조회할 수 없습니다. GitHub 저장 데이터를 표시합니다.",
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "바이낸스 심볼을 조회할 수 없습니다. 데이터 확인 중입니다.",
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
