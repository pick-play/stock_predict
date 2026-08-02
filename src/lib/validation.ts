import { z } from "zod";

export const QuoteSchema = z.object({
  symbol: z.string().min(1),
  lastPrice: z.number().positive().nullable(),
  markPrice: z.number().positive().nullable(),
  bidPrice: z.number().positive().nullable(),
  askPrice: z.number().positive().nullable(),
  eventTime: z.string().datetime(),
});

export const BaselineStockSchema = z.object({
  krxClose: z.number().nonnegative(),
  binanceReferencePrice: z.number().nonnegative(),
  referencePriceMode: z.enum(["mark", "mid", "last"]),
});

export const BaselineSchema = z.object({
  marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  capturedAt: z.string().datetime(),
  timezone: z.string(),
  stocks: z.object({
    samsung: BaselineStockSchema,
    skHynix: BaselineStockSchema,
  }),
});

export const StockSnapshotSchema = z.object({
  displayName: z.string(),
  koreanTicker: z.string(),
  binanceSymbol: z.string(),
  krxClose: z.number().nonnegative(),
  baselineBinancePrice: z.number().nonnegative(),
  currentBinancePrice: z.number().nonnegative(),
  referencePriceMode: z.enum(["mark", "mid", "last"]),
  rawEstimatedPrice: z.number(),
  estimatedPrice: z.number().nonnegative(),
  changeAmount: z.number(),
  changeRate: z.number(),
  bidPrice: z.number().positive().nullable(),
  askPrice: z.number().positive().nullable(),
  spreadPercent: z.number().nullable(),
  confidenceScore: z.number().min(0).max(100),
  eventTime: z.string().datetime(),
  status: z.enum(["healthy", "stale", "error", "loading", "no-baseline"]),
});

export const LatestDataSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  source: z.enum(["binance-rest", "binance-websocket", "github-snapshot"]),
  stocks: z.object({
    samsung: StockSnapshotSchema,
    skHynix: StockSnapshotSchema,
  }),
});

export type ValidatedBaseline = z.infer<typeof BaselineSchema>;
export type ValidatedLatestData = z.infer<typeof LatestDataSchema>;
