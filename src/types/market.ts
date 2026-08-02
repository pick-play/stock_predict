export type StockId = "samsung" | "skHynix";
export type ReferencePriceMode = "mark" | "mid" | "last";
export type DataSource = "binance-rest" | "binance-websocket" | "github-snapshot";
export type StockStatus = "healthy" | "stale" | "error" | "loading" | "no-baseline";

export interface StockConfig {
  id: StockId;
  displayName: string;
  koreanTicker: string;
  binanceSymbol: string;
}

export interface BaselineStock {
  krxClose: number;
  binanceReferencePrice: number;
  referencePriceMode: ReferencePriceMode;
}

export interface Baseline {
  marketDate: string;
  capturedAt: string;
  timezone: string;
  stocks: Record<StockId, BaselineStock>;
}

export interface StockSnapshot {
  displayName: string;
  koreanTicker: string;
  binanceSymbol: string;
  krxClose: number;
  baselineBinancePrice: number;
  currentBinancePrice: number;
  referencePriceMode: ReferencePriceMode;
  rawEstimatedPrice: number;
  estimatedPrice: number;
  changeAmount: number;
  changeRate: number;
  bidPrice: number | null;
  askPrice: number | null;
  spreadPercent: number | null;
  confidenceScore: number;
  eventTime: string;
  status: StockStatus;
}

export interface LatestData {
  schemaVersion: number;
  generatedAt: string;
  source: DataSource;
  stocks: Record<StockId, StockSnapshot>;
}

export interface HistoryEntry {
  timestamp: string;
  stocks: Record<
    StockId,
    {
      estimatedPrice: number;
      changeRate: number;
      currentBinancePrice: number;
      confidenceScore: number;
    }
  >;
}

export type Direction = "rise" | "fall" | "neutral";
