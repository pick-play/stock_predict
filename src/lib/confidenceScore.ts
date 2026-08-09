import type { NormalizedQuote } from "./binance/types";
import { isWeekend, getLastKrxCloseMs } from "./koreaMarket";

interface ConfidenceInput {
  quote: NormalizedQuote | null;
  /** True once a usable KRX anchor price is available. */
  hasAnchor: boolean;
  /** UTC ms of the anchor instant, or null when no anchor resolved. */
  anchorTimeMs: number | null;
  usingFallback: boolean;
}

export function calculateConfidenceScore(input: ConfidenceInput): number {
  let score = 100;

  if (!input.quote) return 0;

  const now = Date.now();
  const eventTime = new Date(input.quote.eventTime).getTime();
  const ageMs = now - eventTime;

  if (ageMs > 60_000) score -= 10;
  if (ageMs > 5 * 60_000) score -= 30;

  const bid = input.quote.bidPrice;
  const ask = input.quote.askPrice;
  if (bid !== null && ask !== null && bid > 0 && ask > 0) {
    const spread = (ask - bid) / ask;
    if (spread > 0.005) score -= 10;
  } else {
    score -= 10;
  }

  if (input.quote.volume24h !== null && input.quote.volume24h < 1000) {
    score -= 15;
  }

  if (input.quote.markPrice === null) score -= 10;

  if (!input.hasAnchor) {
    score -= 25;
  } else if (input.anchorTimeMs !== null) {
    // Penalise only when the anchor predates the last KRX close (1-min
    // tolerance for collectors that capture just after the bell). A Friday
    // anchor is still the correct reference on Sunday, so weekends alone
    // must not trigger this deduction.
    if (input.anchorTimeMs < getLastKrxCloseMs() - 60_000) score -= 25;
  }

  if (isWeekend()) score -= 10;

  if (input.usingFallback) score -= 20;

  return Math.max(0, Math.min(100, score));
}
