export type StockId =
  | "samsung"
  | "skHynix"
  | "hyundai"
  | "samsungEM"
  | "lgElectronics"
  | "hanmi"
  | "naver";
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
 *
 * Partial: the collector records a stock only once Yahoo has settled its daily
 * bar, so an anchor legitimately carries a subset. Demanding every listed stock
 * would mean one unsettled ticker invalidates the file that prices all of them.
 */
export interface BaselineAnchor {
  marketDate: string;
  anchorTimeUtc: string;
  stocks: Partial<Record<StockId, { krxPrice: number }>>;
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
  /**
   * True when the estimate was held at the night session's ±8% limit rather
   * than following the overseas contract further. The card says so, so that a
   * capped number is never presented as the calculation's own answer.
   *
   * Optional because snapshots restored from the stored fallback predate the
   * field; requiring it would fail every one of them.
   */
  limited?: boolean;
  /** Which KRX reference the estimate is measured from. */
  anchorKind?: AnchorKind;
  /** Trading day that reference belongs to ("YYYY-MM-DD"). */
  anchorMarketDate?: string;
}

export interface LatestData {
  schemaVersion: number;
  generatedAt: string;
  source: DataSource;
  // Partial for the same reason as HistoryEntry: the collector writes only the
  // stocks whose fetch succeeded, so a snapshot missing one is normal data.
  stocks: Partial<Record<StockId, StockSnapshot>>;
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
        // Absent on series derived live from candles: a stored snapshot has a
        // measured data-quality score, a recomputed point has nothing to score.
        confidenceScore?: number;
      }
    >
  >;
}

export type Direction = "rise" | "fall" | "neutral";
