import { z } from "zod";

export const QuoteSchema = z
  .object({
    symbol: z.string().min(1),
    lastPrice: z.number().positive().nullable(),
    markPrice: z.number().positive().nullable(),
    bidPrice: z.number().positive().nullable(),
    askPrice: z.number().positive().nullable(),
    eventTime: z
      .string()
      .datetime()
      .refine(
        (val) => new Date(val).getTime() <= Date.now() + 5 * 60_000,
        { message: "eventTime is too far in the future" }
      ),
  })
  .superRefine((data, ctx) => {
    if (
      data.bidPrice !== null &&
      data.askPrice !== null &&
      data.bidPrice > data.askPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bidPrice must be <= askPrice",
        path: ["bidPrice"],
      });
    }
  });

export const BaselineStockSchema = z.object({
  krxClose: z.number().positive(),
  binanceReferencePrice: z.number().positive(),
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
  // nonnegative (not positive) so no-baseline snapshots with 0 values are valid
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
  // "github-actions" is the value written by GitHub Actions scripts
  source: z.enum(["binance-rest", "binance-websocket", "github-snapshot", "github-actions"]),
  stocks: z.object({
    samsung: StockSnapshotSchema,
    skHynix: StockSnapshotSchema,
  }),
});

// HistoryEntry schema — used for history.json validation in the browser
const HistoryStockSchema = z.object({
  estimatedPrice: z.number().nonnegative(),
  changeRate: z.number(),
  currentBinancePrice: z.number().nonnegative(),
  confidenceScore: z.number().min(0).max(100),
});

export const HistoryEntrySchema = z.object({
  timestamp: z.string().datetime(),
  stocks: z.object({
    samsung: HistoryStockSchema.optional(),
    skHynix: HistoryStockSchema.optional(),
  }),
});

export const HistoryArraySchema = z.array(HistoryEntrySchema);

export type ValidatedBaseline = z.infer<typeof BaselineSchema>;
export type ValidatedLatestData = z.infer<typeof LatestDataSchema>;
export type ValidatedHistoryEntry = z.infer<typeof HistoryEntrySchema>;
