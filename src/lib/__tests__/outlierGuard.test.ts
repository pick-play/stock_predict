import { describe, it, expect } from "vitest";
import { isChangeRateOutlier, isPriceRatioOutlier } from "../outlierGuard";

describe("isChangeRateOutlier", () => {
  it("returns false for changes within ±30%", () => {
    expect(isChangeRateOutlier(0)).toBe(false);
    expect(isChangeRateOutlier(0.29)).toBe(false);
    expect(isChangeRateOutlier(-0.29)).toBe(false);
    expect(isChangeRateOutlier(0.3)).toBe(false); // exactly at boundary — not strictly over
  });

  it("returns true for changes exceeding +30%", () => {
    expect(isChangeRateOutlier(0.31)).toBe(true);
    expect(isChangeRateOutlier(1.0)).toBe(true);
  });

  it("returns true for changes exceeding −30%", () => {
    expect(isChangeRateOutlier(-0.31)).toBe(true);
    expect(isChangeRateOutlier(-1.0)).toBe(true);
  });
});

describe("isPriceRatioOutlier", () => {
  it("returns false for normal price movements", () => {
    expect(isPriceRatioOutlier(100, 100)).toBe(false);
    expect(isPriceRatioOutlier(110, 100)).toBe(false);
    expect(isPriceRatioOutlier(90, 100)).toBe(false);
    expect(isPriceRatioOutlier(200, 100)).toBe(false); // exactly 2× — not strictly over
    expect(isPriceRatioOutlier(50, 100)).toBe(false);  // exactly 0.5× — not strictly under
  });

  it("returns true when current price is less than 0.5× previous", () => {
    expect(isPriceRatioOutlier(49, 100)).toBe(true);
    expect(isPriceRatioOutlier(1, 100)).toBe(true);
  });

  it("returns true when current price is more than 2× previous", () => {
    expect(isPriceRatioOutlier(201, 100)).toBe(true);
    expect(isPriceRatioOutlier(1000, 100)).toBe(true);
  });

  it("returns false when previousPrice is zero or non-positive (no reference to compare)", () => {
    expect(isPriceRatioOutlier(100, 0)).toBe(false);
    expect(isPriceRatioOutlier(100, -10)).toBe(false);
  });

  it("returns false when previousPrice is non-finite", () => {
    expect(isPriceRatioOutlier(100, NaN)).toBe(false);
    expect(isPriceRatioOutlier(100, Infinity)).toBe(false);
  });

  it("returns true when currentPrice is zero or non-positive", () => {
    expect(isPriceRatioOutlier(0, 100)).toBe(true);
    expect(isPriceRatioOutlier(-1, 100)).toBe(true);
  });
});
