import type { NormalizedQuote } from "./binance/types";
import type { BaselineStock } from "../types/market";
import { isWeekend } from "./koreaMarket";

interface ConfidenceInput {
  quote: NormalizedQuote | null;
  baseline: BaselineStock | null;
  baselineDate: string | null;
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

  if (input.baseline === null) {
    score -= 25;
  } else if (input.baselineDate) {
    const baselineAge = now - new Date(input.baselineDate).getTime();
    if (baselineAge > 2 * 24 * 60 * 60 * 1000) score -= 25;
  }

  if (isWeekend()) score -= 10;

  if (input.usingFallback) score -= 20;

  return Math.max(0, Math.min(100, score));
}
