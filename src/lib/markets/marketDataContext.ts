/**
 * Context plumbing for the shared market feed.
 *
 * Split out of MarketDataProvider.tsx because the fast-refresh lint rule wants a
 * .tsx file to export components and nothing else; the context object and its
 * reader hook live here so the provider file stays a pure component module.
 */

import { createContext, useContext } from "react";
import type { MarketTickerState } from "../../hooks/useMarketTicker";

const EMPTY: MarketTickerState = { items: [], isLoading: false };

export const MarketDataContext = createContext<MarketTickerState>(EMPTY);

/**
 * Falls back to an empty feed rather than throwing when no provider is above.
 * A missing tape is a cosmetic loss; taking the whole dashboard down with it
 * would not be.
 */
export function useSharedMarketData(): MarketTickerState {
  return useContext(MarketDataContext);
}
