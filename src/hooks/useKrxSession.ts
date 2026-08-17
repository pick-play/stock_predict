/**
 * Whether the Korean exchange is actually open right now.
 *
 * The clock alone cannot answer this. isKrxTradingHours() knows the weekday and
 * the hours and nothing else, so on 2026-08-17 — a substitute holiday for
 * 광복절 — the site announced 국내장 거래 중 all morning while KRX was shut.
 * A hard-coded holiday table would fix that day and rot: it needs a human to
 * remember 대체공휴일, 임시공휴일 and election days, every year, before they
 * happen.
 *
 * The market feed already knows. Yahoo reports the current trading period for
 * ^KS11, and the Worker turns it into open / closed / unknown; on that holiday
 * it correctly said closed, with the last session still showing 08-14. So the
 * observed session decides, and the calendar is only the fallback for when the
 * feed has not answered yet.
 */

import { useSharedMarketData } from "../lib/markets/marketDataContext";
import { isKrxTradingHours } from "../lib/koreaMarket";

/** The instrument whose session stands for "the Korean market". */
const KRX_PROXY_ID = "kospi";

export interface KrxSession {
  /** True only when the exchange is open. */
  trading: boolean;
  /**
   * Where the answer came from. "observed" means the market feed reported the
   * session; "clock" means it had nothing to say and the weekday/hours rule was
   * used instead.
   */
  source: "observed" | "clock";
}

export function useKrxSession(now: Date = new Date()): KrxSession {
  const { items } = useSharedMarketData();
  const kospi = items.find((item) => item.id === KRX_PROXY_ID);

  if (kospi && kospi.status !== "unknown") {
    return { trading: kospi.status === "open", source: "observed" };
  }

  /*
   * No feed yet — the first paint, an offline reader, or a page rendered outside
   * the provider. The calendar is wrong on holidays, which is the whole reason
   * this hook exists, so err toward not claiming the market is open: outside
   * weekday trading hours it is certainly closed, and inside them this is a
   * guess that the feed corrects within seconds.
   */
  return { trading: isKrxTradingHours(now), source: "clock" };
}
