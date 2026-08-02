import type { StockId, StockConfig } from "../types/market";

export const MARKET_SYMBOLS: Record<StockId, StockConfig> = {
  samsung: {
    id: "samsung",
    displayName: "삼성전자",
    koreanTicker: "005930",
    binanceSymbol: "SAMSUNGUSDT",
  },
  skHynix: {
    id: "skHynix",
    displayName: "SK하이닉스",
    koreanTicker: "000660",
    binanceSymbol: "SKHYNIXUSDT",
  },
} as const;

export const STOCK_IDS = ["samsung", "skHynix"] as const;
