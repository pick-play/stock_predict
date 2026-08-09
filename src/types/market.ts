export type StockId = "samsung" | "skHynix";
export type ReferencePriceMode = "mark" | "mid" | "last";
export type DataSource = "binance-rest" | "binance-websocket" | "github-snapshot" | "github-actions";
export type StockStatus = "healthy" | "stale" | "error" | "loading" | "no-baseline";

export interface StockConfig {
  id: StockId;
  displayName: string;
  koreanTicker: string;
  binanceSymbol: string;
}

export type AnchorKind = "open" | "close";

/**
 * One KRX reference point: the opening or closing price of a trading day,
 * together with the instant the matching futures price must be read at.
 */
export interface BaselineAnchor {
  marketDate: string;
  anchorTimeUtc: string;
  stocks: Record<StockId, { krxPrice: number }>;
}

export interface Baseline {
  schemaVersion: 2;
  timezone: string;
  updatedAt: string;
  referencePriceMode: ReferencePriceMode;
  open: BaselineAnchor | null;
  close: BaselineAnchor | null;
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
  /** Which KRX reference the estimate is measured from. */
  anchorKind?: AnchorKind;
  /** Trading day that reference belongs to ("YYYY-MM-DD"). */
  anchorMarketDate?: string;
}

export interface LatestData {
  schemaVersion: number;
  generatedAt: string;
  source: DataSource;
  stocks: Record<StockId, StockSnapshot>;
}

export interface HistoryEntry {
  timestamp: string;
  // Partial: a snapshot may contain only the stocks that updated successfully
  // (per-stock failure isolation), matching HistoryEntrySchema's optional fields.
  stocks: Partial<
    Record<
      StockId,
      {
        estimatedPrice: number;
        changeRate: number;
        currentBinancePrice: number;
        confidenceScore: number;
      }
    >
  >;
}

export type Direction = "rise" | "fall" | "neutral";
