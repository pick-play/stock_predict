import { describe, it, expect } from "vitest";
import {
  formatTickerPrice,
  formatTickerPercent,
} from "../formatTicker";

describe("formatTickerPrice", () => {
  it("groups thousands and pins the decimal count", () => {
    expect(formatTickerPrice(29722.303, 2)).toBe("29,722.30");
    expect(formatTickerPrice(54036.93, 2)).toBe("54,036.93");
  });

  it("renders whole numbers when no decimals are wanted", () => {
    expect(formatTickerPrice(64878, 0)).toBe("64,878");
  });

  it("pads to the requested precision", () => {
    expect(formatTickerPrice(4.6, 3)).toBe("4.600");
  });
});

describe("formatTickerPercent", () => {
  // The reason this formatter exists: lib/format.ts's formatPercent takes a
  // rate and multiplies by 100, which would turn +0.62% into +62%.
  it("treats the input as percentage points, not a rate", () => {
    expect(formatTickerPercent(0.62)).toBe("+0.62%");
    expect(formatTickerPercent(1.19)).toBe("+1.19%");
  });

  it("signs gains and leaves losses with their own minus", () => {
    expect(formatTickerPercent(2.3)).toBe("+2.30%");
    expect(formatTickerPercent(-0.86)).toBe("-0.86%");
  });

  it("leaves a flat reading unsigned, per §24", () => {
    expect(formatTickerPercent(0)).toBe("0.00%");
  });

  it("degrades to a dash rather than printing NaN", () => {
    expect(formatTickerPercent(Number.NaN)).toBe("―");
    expect(formatTickerPercent(Number.POSITIVE_INFINITY)).toBe("―");
  });
});
