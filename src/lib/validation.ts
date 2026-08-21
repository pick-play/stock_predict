import { z } from "zod";
import { STOCK_IDS } from "../config/symbols";
import type { StockId } from "../types/market";

/**
 * A stocks map keyed by every listed stock, with every key optional.
 *
 * Optional is the load-bearing part. baseline.json is fetched on every page
 * load, and a newly listed stock only appears in it after the collector has
 * managed a run for it. If a new key were required, adding a stock would fail
 * the live file outright and put the whole site into "기준가격 갱신 필요" until
 * the next successful collection — a self-inflicted outage on every listing.
 * z.object also strips ids it does not know, so an old file with a retired
 * stock still parses.
 */
function optionalStockMap<T extends z.ZodTypeAny>(value: T) {
  return z.object(
    Object.fromEntries(STOCK_IDS.map((id) => [id, value.optional()])) as {
      [K in StockId]: z.ZodOptional<T>;
    }
  );
}

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

export const BaselineAnchorSchema = z.object({
  marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  anchorTimeUtc: z.string().datetime(),
  stocks: optionalStockMap(z.object({ krxPrice: z.number().positive() })),
});

/**
 * schemaVersion 2 keeps the opening and closing anchors separately so the app
 * can reference today's open during regular hours and the last close outside
 * them. A v1 file fails this schema on purpose: it carries no open anchor, and
 * silently reusing its close would mislabel the basis shown to the user.
 */
export const BaselineSchema = z
  .object({
    schemaVersion: z.literal(2),
    timezone: z.string(),
    updatedAt: z.string().datetime(),
    referencePriceMode: z.enum(["mark", "mid", "last"]),
    // default(null) keeps a missing anchor out of the parsed type as `null`
    // rather than `undefined`, matching the Baseline interface exactly.
    open: BaselineAnchorSchema.nullable().default(null),
    close: BaselineAnchorSchema.nullable().default(null),
  })
  .refine((data) => data.open != null || data.close != null, {
    message: "baseline must contain at least one anchor",
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
  // z.object strips unknown keys, so an undeclared `limited` would survive
  // validation but vanish from the parsed snapshot — the fallback card would
  // then present a capped price without the caption saying it was capped.
  // Optional because files written before the cap existed do not carry it.
  limited: z.boolean().optional(),
});

export const LatestDataSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  // "github-actions" is the value written by GitHub Actions scripts
  source: z.enum(["binance-rest", "binance-websocket", "github-snapshot", "github-actions"]),
  stocks: optionalStockMap(StockSnapshotSchema),
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
  stocks: optionalStockMap(HistoryStockSchema),
});

export const HistoryArraySchema = z.array(HistoryEntrySchema);

export type ValidatedBaseline = z.infer<typeof BaselineSchema>;
export type ValidatedLatestData = z.infer<typeof LatestDataSchema>;
export type ValidatedHistoryEntry = z.infer<typeof HistoryEntrySchema>;
