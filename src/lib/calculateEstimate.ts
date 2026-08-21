import { roundToKrxTick } from "./roundToKrxTick";
import { NIGHT_SESSION_LIMIT_RATE } from "../config/market";

export interface EstimateInput {
  krxClose: number;
  currentBinancePrice: number;
  baselineBinancePrice: number;
}

export interface EstimateResult {
  rawEstimatedPrice: number;
  estimatedPrice: number;
  changeRate: number;
  changeAmount: number;
  /**
   * True when the overseas move ran past the night session's price limit and the
   * estimate was held at the boundary. The card should say so rather than
   * presenting a capped number as if it were the calculation's own answer.
   */
  limited: boolean;
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const { krxClose, currentBinancePrice, baselineBinancePrice } = input;

  if (
    !Number.isFinite(krxClose) ||
    !Number.isFinite(currentBinancePrice) ||
    !Number.isFinite(baselineBinancePrice) ||
    krxClose <= 0 ||
    currentBinancePrice <= 0 ||
    baselineBinancePrice <= 0
  ) {
    throw new Error("Invalid estimate input");
  }

  const rawChangeRate = currentBinancePrice / baselineBinancePrice - 1;

  /*
   * Held to the night session's price limit (owner decision, 2026-08-22).
   *
   * A domestic order cannot print beyond ±8% of the reference price in the
   * after-hours session, so an estimate outside that band is describing a fill
   * that could not happen. The overseas contract has no such limit: it can run
   * 12% on news and the naive number would follow it there.
   *
   * The cap is applied to the RATE, before the price is derived, so the rounded
   * price and the change amount all agree with the clamped figure — clamping
   * afterwards would leave changeRate and changeAmount telling different
   * stories.
   *
   * rawEstimatedPrice keeps the uncapped value: it is what the calculation
   * actually produced, and the card needs it to say the limit was reached.
   */
  /*
   * The epsilon is not decoration. 108/100 - 1 is 0.08000000000000007 in binary
   * floating point, so a bare `>` reports a price sitting exactly on the limit
   * as having exceeded it — and the card would announce a cap that never
   * applied. The boundary itself is a legal price.
   */
  const limited =
    Math.abs(rawChangeRate) > NIGHT_SESSION_LIMIT_RATE + Number.EPSILON * 8;
  const changeRate = limited
    ? Math.sign(rawChangeRate) * NIGHT_SESSION_LIMIT_RATE
    : rawChangeRate;

  const rawEstimatedPrice = krxClose * (1 + rawChangeRate);

  const estimatedPrice = roundToKrxTick(krxClose * (1 + changeRate));

  return {
    rawEstimatedPrice,
    estimatedPrice,
    changeRate,
    changeAmount: estimatedPrice - krxClose,
    limited,
  };
}
