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
