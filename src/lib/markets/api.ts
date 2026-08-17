/**
 * Client for GET /api/markets, the Worker route that proxies Yahoo Finance.
 *
 * The proxy exists for CORS: Yahoo sends no Access-Control-Allow-Origin, so the
 * browser cannot read it directly. The Worker base URL is the same one the board
 * uses, so an unconfigured deployment simply has no tape rather than a broken
 * one.
 */

import { z } from "zod";
import type { MarketsResponse } from "../../types/ticker";
import { resolveApiBase } from "../apiBase";

export const MARKETS_API_BASE = resolveApiBase(
  import.meta.env.VITE_BOARD_API_BASE as string | undefined
);

export const isMarketsConfigured = MARKETS_API_BASE.length > 0;

const MarketQuoteSchema = z.object({
  id: z.string().min(1),
  price: z.number().positive(),
  previousClose: z.number().positive(),
  changePercent: z.number().finite(),
  asOf: z.string().datetime(),
  status: z.enum(["open", "closed", "unknown"]),
  sessionStart: z.string().datetime().nullable(),
  sessionEnd: z.string().datetime().nullable(),
});

const MarketsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  quotes: z.array(MarketQuoteSchema),
});

/**
 * Returns null on any failure — unreachable, non-2xx, or a payload that does
 * not validate. The tape is decoration around the estimate cards; it hides
 * itself rather than turning a proxy hiccup into a visible error.
 */
export async function fetchMarkets(
  signal?: AbortSignal
): Promise<MarketsResponse | null> {
  if (!isMarketsConfigured) return null;

  try {
    const res = await fetch(`${MARKETS_API_BASE}/api/markets`, { signal });
    if (!res.ok) {
      console.warn(`[markets] HTTP ${res.status}`);
      return null;
    }
    const parsed = MarketsResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.warn("[markets] schema validation failed");
      return null;
    }
    return parsed.data;
  } catch (err) {
    // An aborted request is the normal result of unmount or a new range, not a
    // fault worth logging.
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.warn("[markets] fetch failed", err);
    }
    return null;
  }
}
