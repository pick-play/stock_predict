/**
 * The thumbnail's one job beyond looking like the last few hours: agreeing with
 * the number printed beside it.
 *
 * Its colour used to come from the series' own first-to-last direction, which
 * asks a different question over a different window than the card's change
 * against the domestic close. When the two disagreed the card showed a red
 * figure over a blue line. Owner decision, 2026-08-22: the change wins.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "../Sparkline";

const RISE = "#ff4d5e";
const FALL = "#3f82ff";

const strokeOf = (c: HTMLElement) =>
  c.querySelector("path[stroke]")!.getAttribute("stroke");

describe("Sparkline", () => {
  it("takes its colour from the card's change, not the series", () => {
    // A series that fell over its own window, on a card that is up for the day.
    const { container } = render(
      <Sparkline data={[110, 105, 100]} changeRate={0.02} />
    );
    expect(strokeOf(container)).toBe(RISE);
  });

  it("and the other way round", () => {
    const { container } = render(
      <Sparkline data={[100, 105, 110]} changeRate={-0.02} />
    );
    expect(strokeOf(container)).toBe(FALL);
  });

  it("falls back to the series when no change is given", () => {
    const { container } = render(<Sparkline data={[100, 105, 110]} />);
    expect(strokeOf(container)).toBe(RISE);
  });

  it("draws nothing from a single point", () => {
    const { container } = render(<Sparkline data={[100]} changeRate={0.01} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lets the caller size it, so the card can differ by breakpoint", () => {
    const { container } = render(
      <Sparkline data={[1, 2]} className="h-9 w-[108px]" />
    );
    expect(container.querySelector("svg")!.getAttribute("class")).toContain(
      "w-[108px]"
    );
  });
});
