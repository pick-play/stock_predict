import { describe, it, expect } from "vitest";
import { roundToKrxTick, getKrxTickSize } from "../roundToKrxTick";

describe("getKrxTickSize", () => {
  it("returns 1 for prices under 1,000", () => {
    expect(getKrxTickSize(0)).toBe(1);
    expect(getKrxTickSize(500)).toBe(1);
    expect(getKrxTickSize(999)).toBe(1);
  });

  it("returns 5 for 1,000–4,999", () => {
    expect(getKrxTickSize(1_000)).toBe(5);
    expect(getKrxTickSize(4_999)).toBe(5);
  });

  it("returns 10 for 5,000–9,999", () => {
    expect(getKrxTickSize(5_000)).toBe(10);
    expect(getKrxTickSize(9_999)).toBe(10);
  });

  it("returns 50 for 10,000–49,999", () => {
    expect(getKrxTickSize(10_000)).toBe(50);
    expect(getKrxTickSize(49_999)).toBe(50);
  });

  it("returns 100 for 50,000–99,999", () => {
    expect(getKrxTickSize(50_000)).toBe(100);
    expect(getKrxTickSize(99_999)).toBe(100);
  });

  it("returns 500 for 100,000–499,999", () => {
    expect(getKrxTickSize(100_000)).toBe(500);
    expect(getKrxTickSize(499_999)).toBe(500);
  });

  it("returns 1,000 for 500,000+", () => {
    expect(getKrxTickSize(500_000)).toBe(1_000);
    expect(getKrxTickSize(1_000_000)).toBe(1_000);
  });

  it("throws for negative or non-finite values", () => {
    expect(() => getKrxTickSize(-1)).toThrow();
    expect(() => getKrxTickSize(NaN)).toThrow();
    expect(() => getKrxTickSize(Infinity)).toThrow();
  });
});

describe("roundToKrxTick", () => {
  it("1,000원 미만은 1원 단위로 반올림한다", () => {
    expect(roundToKrxTick(999.4)).toBe(999);
    expect(roundToKrxTick(999.5)).toBe(1_000);
  });

  it("1,000원 이상 5,000원 미만은 5원 단위다", () => {
    expect(roundToKrxTick(1_002)).toBe(1_000);
    expect(roundToKrxTick(1_002.5)).toBe(1_005);
  });

  it("5,000원 이상 10,000원 미만은 10원 단위다", () => {
    expect(roundToKrxTick(7_124)).toBe(7_120);
    expect(roundToKrxTick(7_125)).toBe(7_130);
  });

  it("10,000원 이상 50,000원 미만은 50원 단위다", () => {
    expect(roundToKrxTick(32_424)).toBe(32_400);
    expect(roundToKrxTick(32_425)).toBe(32_450);
  });

  it("50,000원 이상 100,000원 미만은 100원 단위다", () => {
    expect(roundToKrxTick(72_149)).toBe(72_100);
    expect(roundToKrxTick(72_150)).toBe(72_200);
  });

  it("100,000원 이상 500,000원 미만은 500원 단위다", () => {
    expect(roundToKrxTick(187_249)).toBe(187_000);
    expect(roundToKrxTick(187_250)).toBe(187_500);
  });

  it("500,000원 이상은 1,000원 단위다", () => {
    expect(roundToKrxTick(500_499)).toBe(500_000);
    expect(roundToKrxTick(500_500)).toBe(501_000);
  });

  it("잘못된 값을 거부한다", () => {
    expect(() => roundToKrxTick(-1)).toThrow();
    expect(() => roundToKrxTick(Number.NaN)).toThrow();
    expect(() => roundToKrxTick(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("경계 교차: 999.5 → 1,000 (tick size 변경 처리)", () => {
    // 999.5 rounds to 1000 with tick=1, then tick size becomes 5
    // re-rounds 1000/5*5 = 1000 (stays same)
    expect(roundToKrxTick(999.5)).toBe(1_000);
  });

  it("부동소수점 경계: 4,999.5 → 5,000 (tick 5→10 교차)", () => {
    // tick=5: round(4999.5/5)=round(999.9)=1000 → 5000
    // tick 5→10, re-round: round(4999.5/10)=round(499.95)=500 → 5000
    expect(roundToKrxTick(4_999.5)).toBe(5_000);
  });

  it("부동소수점 경계: 9,999.5 → 10,000 (tick 10→50 교차)", () => {
    // tick=10: round(9999.5/10)=1000 → 10000
    // tick 10→50, re-round: round(9999.5/50)=200 → 10000
    expect(roundToKrxTick(9_999.5)).toBe(10_000);
  });

  it("부동소수점 경계: 49,999.5 → 50,000 (tick 50→100 교차)", () => {
    expect(roundToKrxTick(49_999.5)).toBe(50_000);
  });

  it("부동소수점 경계: 99,999.5 → 100,000 (tick 100→500 교차)", () => {
    expect(roundToKrxTick(99_999.5)).toBe(100_000);
  });

  it("부동소수점 경계: 499,999.5 → 500,000 (tick 500→1000 교차)", () => {
    expect(roundToKrxTick(499_999.5)).toBe(500_000);
  });

  it("Number.EPSILON 내의 미세한 부동소수점 오차를 올바르게 처리한다", () => {
    // 7125 is exactly on the half-way point for tick=10
    // floating-point representation should still round up
    expect(roundToKrxTick(7_125)).toBe(7_130);
    expect(roundToKrxTick(7_124.999999999)).toBe(7_120);
  });
});
