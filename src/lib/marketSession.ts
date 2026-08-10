/**
 * marketSession.ts
 *
 * Chooses which KRX reference point the estimate is built on.
 *
 * During the regular session the market has already opened, so today's opening
 * price is the meaningful basis: the overnight gap is realised and what matters
 * is the move since the open. Outside the session — evening, overnight, weekend,
 * holiday — the last completed close is the basis.
 */

import type {
  AnchorKind,
  Baseline,
  BaselineAnchor,
  StockId,
} from "../types/market";
import { getSeoulDate, isKrxTradingHours } from "./koreaMarket";

export interface ResolvedAnchor {
  kind: AnchorKind;
  marketDate: string;
  /** UTC ms of the instant the futures reference price must be read at. */
  anchorTimeMs: number;
  krxPrice: Record<StockId, number>;
}

/** Today's date in Seoul as "YYYY-MM-DD". */
export function seoulDateString(now: Date = new Date()): string {
  const { year, month, day } = getSeoulDate(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toResolved(anchor: BaselineAnchor, kind: AnchorKind): ResolvedAnchor | null {
  const anchorTimeMs = new Date(anchor.anchorTimeUtc).getTime();
  if (!Number.isFinite(anchorTimeMs)) return null;

  const samsung = anchor.stocks.samsung?.krxPrice;
  const skHynix = anchor.stocks.skHynix?.krxPrice;
  if (!(samsung > 0) || !(skHynix > 0)) return null;

  return {
    kind,
    marketDate: anchor.marketDate,
    anchorTimeMs,
    krxPrice: { samsung, skHynix },
  };
}

/**
 * Resolve the anchor to estimate against.
 *
 * Uses today's open only while the market is actually open and that open has
 * already been captured; right after 09:00 the collector may not have run yet,
 * in which case the previous close still describes the market correctly.
 */
export function resolveAnchor(
  baseline: Baseline | null,
  now: Date = new Date()
): ResolvedAnchor | null {
  if (!baseline) return null;

  if (isKrxTradingHours(now) && baseline.open) {
    if (baseline.open.marketDate === seoulDateString(now)) {
      const resolved = toResolved(baseline.open, "open");
      if (resolved) return resolved;
    }
  }

  if (baseline.close) {
    const resolved = toResolved(baseline.close, "close");
    if (resolved) return resolved;
  }

  // Last resort: an open anchor from an earlier day is still a real reference
  // point, and labelling it as such beats showing nothing.
  if (baseline.open) return toResolved(baseline.open, "open");

  return null;
}

/** Short label describing what the estimate is measured against. */
export function anchorLabel(kind: AnchorKind): string {
  return kind === "open" ? "오늘 시가" : "최근 종가";
}
