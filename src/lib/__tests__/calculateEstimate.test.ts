import { describe, it, expect } from "vitest";
import { calculateEstimate } from "../calculateEstimate";

describe("calculateEstimate", () => {
  it("calculates correct estimate for rise", () => {
    const result = calculateEstimate({
      krxClose: 100_000,
      currentBinancePrice: 73.42,
      baselineBinancePrice: 71.77,
    });

    expect(result.changeRate).toBeCloseTo(0.023, 2);
    expect(result.rawEstimatedPrice).toBeCloseTo(102_299, 0);
    expect(result.estimatedPrice).toBe(102_500); // rounded to 500-won tick
    expect(result.changeAmount).toBe(2_500);
  });

  it("calculates correct estimate for fall", () => {
    const result = calculateEstimate({
      krxClose: 100_000,
      currentBinancePrice: 70,
      baselineBinancePrice: 71.77,
    });

    expect(result.changeRate).toBeLessThan(0);
    expect(result.estimatedPrice).toBeLessThan(100_000);
  });

  it("returns zero change when prices are equal", () => {
    const result = calculateEstimate({
      krxClose: 50_000,
      currentBinancePrice: 100,
      baselineBinancePrice: 100,
    });

    expect(result.changeRate).toBe(0);
    expect(result.estimatedPrice).toBe(50_000);
    expect(result.changeAmount).toBe(0);
  });

  it("throws for zero krxClose", () => {
    expect(() =>
      calculateEstimate({
        krxClose: 0,
        currentBinancePrice: 100,
        baselineBinancePrice: 100,
      })
    ).toThrow("Invalid estimate input");
  });

  it("throws for zero currentBinancePrice", () => {
    expect(() =>
      calculateEstimate({
        krxClose: 100_000,
        currentBinancePrice: 0,
        baselineBinancePrice: 100,
      })
    ).toThrow("Invalid estimate input");
  });

  it("throws for zero baselineBinancePrice", () => {
    expect(() =>
      calculateEstimate({
        krxClose: 100_000,
        currentBinancePrice: 100,
        baselineBinancePrice: 0,
      })
    ).toThrow("Invalid estimate input");
  });

  it("throws for negative values", () => {
    expect(() =>
      calculateEstimate({
        krxClose: -100,
        currentBinancePrice: 100,
        baselineBinancePrice: 100,
      })
    ).toThrow("Invalid estimate input");
  });

  it("throws for NaN inputs", () => {
    expect(() =>
      calculateEstimate({
        krxClose: NaN,
        currentBinancePrice: 100,
        baselineBinancePrice: 100,
      })
    ).toThrow("Invalid estimate input");
  });

  it("result estimatedPrice follows KRX tick rules", () => {
    const result = calculateEstimate({
      krxClose: 300_000,
      currentBinancePrice: 218.1,
      baselineBinancePrice: 215.4,
    });

    // estimatedPrice must be divisible by 500 (it's in the 100K–500K range)
    expect(result.estimatedPrice % 500).toBe(0);
  });
});

/**
 * ±8% is the night session's price limit, not a data-quality guard.
 *
 * A domestic after-hours order cannot print outside that band, so an estimate
 * beyond it describes a fill that could not happen — while the overseas
 * contract the estimate follows has no limit and can run further on news.
 */
describe("night session price limit", () => {
  const krxClose = 100_000;

  it("leaves an ordinary move alone", () => {
    const r = calculateEstimate({
      krxClose,
      baselineBinancePrice: 100,
      currentBinancePrice: 103,
    });

    expect(r.changeRate).toBeCloseTo(0.03, 10);
    expect(r.estimatedPrice).toBe(103_000);
    expect(r.limited).toBe(false);
  });

  it("holds a runaway rise at +8%", () => {
    const r = calculateEstimate({
      krxClose,
      baselineBinancePrice: 100,
      currentBinancePrice: 115, // +15% overseas
    });

    expect(r.changeRate).toBeCloseTo(0.08, 10);
    expect(r.estimatedPrice).toBe(108_000);
    expect(r.limited).toBe(true);
  });

  it("holds a runaway fall at -8%", () => {
    const r = calculateEstimate({
      krxClose,
      baselineBinancePrice: 100,
      currentBinancePrice: 80, // -20% overseas
    });

    expect(r.changeRate).toBeCloseTo(-0.08, 10);
    expect(r.estimatedPrice).toBe(92_000);
    expect(r.limited).toBe(true);
  });

  // The rate is capped before the price is derived, so every figure the card
  // shows agrees. Clamping the price afterwards would leave changeRate and
  // changeAmount describing a different number than estimatedPrice.
  it("keeps the price, rate and amount consistent when capped", () => {
    const r = calculateEstimate({
      krxClose,
      baselineBinancePrice: 100,
      currentBinancePrice: 130,
    });

    expect(r.estimatedPrice).toBe(krxClose * (1 + r.changeRate));
    expect(r.changeAmount).toBe(r.estimatedPrice - krxClose);
  });

  // What the calculation actually produced, kept so the card can say the limit
  // was reached rather than quietly presenting the boundary as the answer.
  it("still reports the uncapped price it computed", () => {
    const r = calculateEstimate({
      krxClose,
      baselineBinancePrice: 100,
      currentBinancePrice: 115,
    });

    expect(r.rawEstimatedPrice).toBeCloseTo(115_000, 6);
  });

  it("does not trip exactly at the boundary", () => {
    const r = calculateEstimate({
      krxClose,
      baselineBinancePrice: 100,
      currentBinancePrice: 108,
    });
    expect(r.limited).toBe(false);
  });
});
