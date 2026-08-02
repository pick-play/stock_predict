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
