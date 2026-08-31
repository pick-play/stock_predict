import { roundToKrxTick } from "./roundToKrxTick";

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

  /*
   * The rate is NOT capped to the KRX night session's ±8% price limit (owner
   * decision, 2026-08-31, reversing 2026-08-22). What the card tracks is the
   * overseas futures-linked contract, which has no such limit — the ±8% band
   * belongs to KOSPI night-session fills this site never claims to show. A
   * capped figure answered a question nobody asked and hid how far the
   * overseas market actually moved.
   */
  const changeRate = currentBinancePrice / baselineBinancePrice - 1;

  const rawEstimatedPrice = krxClose * (1 + changeRate);

  const estimatedPrice = roundToKrxTick(rawEstimatedPrice);

  return {
    rawEstimatedPrice,
    estimatedPrice,
    changeRate,
    changeAmount: estimatedPrice - krxClose,
  };
}
