/**
 * Shares one market feed between the ticker tape and the index grid.
 *
 * Both surfaces show the same ten instruments. Calling useMarketTicker in each
 * would run two poll timers and open two Binance sockets for identical data, so
 * the hook runs once here and the result is read from context.
 */

import type { ReactNode } from "react";
import { useMarketTicker } from "../../hooks/useMarketTicker";
import { MarketDataContext } from "../../lib/markets/marketDataContext";

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const state = useMarketTicker();
  return (
    <MarketDataContext.Provider value={state}>
      {children}
    </MarketDataContext.Provider>
  );
}
