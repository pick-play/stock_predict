/**
 * marketSession.ts
 *
 * Chooses which KRX reference point the estimate is built on.
 *
 * It is always the last completed close (owner decision, 2026-08-18).
 *
 * The open anchor is gone. It only ever applied during the regular session —
 * the hours when this site tells the reader to look at real fills instead — and
 * in exchange it introduced a second reference point that had to be captured,
 * validated and explained. What the site is for is the move since the market
 * last closed, and one basis means one number to reason about.
 *
 * The `open` block is still written into baseline.json and the AnchorKind type
 * still has its "open" member: the collector reads both from the same daily bar
 * at no extra cost, and keeping the shape means restoring the behaviour is a
 * resolver change rather than a migration.
 */

import type {
  AnchorKind,
  Baseline,
  BaselineAnchor,
  StockId,
} from "../types/market";
import { getSeoulDate } from "./koreaMarket";

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
 * Resolve the anchor to estimate against: the most recent close.
 *
 * The fallback to an open anchor at the end is not the old behaviour returning.
 * It only fires when there is no close at all — a fresh deployment, or a
 * baseline that lost its close block — where an older real reference point
 * still beats showing nothing.
 */
export function resolveAnchor(baseline: Baseline | null): ResolvedAnchor | null {
  if (!baseline) return null;

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
