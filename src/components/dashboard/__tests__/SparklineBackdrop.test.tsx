/**
 * This chart sits behind the card's content, which is the whole reason it has
 * rules.
 *
 *   - it never speaks: the change is stated as a number with a sign and an
 *     arrow, and no fact is carried by the picture alone (§11.2);
 *   - fewer than two points draws nothing rather than a shape invented from one
 *     value (§12);
 *   - it stretches to whatever box the card gives it rather than claiming a
 *     size, which is what lets the card place it in a corner;
 *   - direction comes from the series — first point against last — not from the
 *     card's change against its anchor, which can disagree.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SparklineBackdrop } from "../SparklineBackdrop";

const RISE = "#ff4d5e";
const FALL = "#3f82ff";

function paths(container: HTMLElement) {
  return Array.from(container.querySelectorAll("path"));
}

describe("SparklineBackdrop", () => {
  it("draws nothing from a single point", () => {
    const { container } = render(<SparklineBackdrop data={[100]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing from an empty series", () => {
    const { container } = render(<SparklineBackdrop data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<SparklineBackdrop data={[1, 2]} />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  it("colours by the series, not by the card's change", () => {
    const up = render(<SparklineBackdrop data={[100, 90, 110]} />);
    const down = render(<SparklineBackdrop data={[100, 130, 90]} />);

    const stroke = (r: typeof up) =>
      paths(r.container).find((p) => p.getAttribute("stroke"))!.getAttribute("stroke");
    expect(stroke(up)).toBe(RISE);
    expect(stroke(down)).toBe(FALL);
  });

  it("stretches to its container rather than dictating a size", () => {
    const { container } = render(<SparklineBackdrop data={[1, 2, 3]} />);
    const svg = container.querySelector("svg")!;

    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("height")).toBeNull();
  });

  /*
   * The box is the card's empty upper-right corner, so the curve may fill it —
   * but not touch its edges, where a flat series would look like a border and a
   * volatile one would have its stroke clipped in half.
   */
  it("uses its box without touching the edges", () => {
    const { container } = render(
      <SparklineBackdrop data={[100, 1_000_000, 100]} />
    );
    const line = paths(container).find((p) => p.getAttribute("stroke"))!;
    const ys = [...line.getAttribute("d")!.matchAll(/,(\d+(?:\.\d+)?)/g)].map(
      (m) => Number(m[1])
    );

    // Viewbox is 100 tall.
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(100);
  });
});
