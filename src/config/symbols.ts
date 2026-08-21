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
  hyundai: {
    id: "hyundai",
    displayName: "현대차",
    koreanTicker: "005380",
    binanceSymbol: "HYUNDAIUSDT",
  },
  samsungEM: {
    id: "samsungEM",
    displayName: "삼성전기",
    koreanTicker: "009150",
    binanceSymbol: "SAMSUNGEMUSDT",
  },
  lgElectronics: {
    id: "lgElectronics",
    displayName: "LG전자",
    koreanTicker: "066570",
    binanceSymbol: "LGELECTRONICSUSDT",
  },
  hanmi: {
    id: "hanmi",
    displayName: "한미반도체",
    koreanTicker: "042700",
    binanceSymbol: "HANMIUSDT",
  },
  naver: {
    id: "naver",
    displayName: "NAVER",
    koreanTicker: "035420",
    binanceSymbol: "NAVERUSDT",
  },
} as const;

/**
 * The listing order every screen iterates in, and the one place a stock is
 * added or removed. Anything that needs "all stocks" reads this instead of
 * spelling out ids, so a new listing cannot reach some views and miss others.
 */
export const STOCK_IDS: StockId[] = [
  "samsung",
  "skHynix",
  "hyundai",
  "samsungEM",
  "lgElectronics",
  "hanmi",
  "naver",
];
