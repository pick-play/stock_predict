/**
 * The wordmark is decoration over a name that is already text, and it belongs
 * to somebody else. Both of those turn into rules a test can hold:
 *
 *   - it never speaks (empty alt, aria-hidden), so the card announces the
 *     company once rather than twice;
 *   - a listing with no file renders nothing and, in particular, requests
 *     nothing — a missing logo must not cost a 404 per card;
 *   - the file comes from this site's own public/logos/, never a third party.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StockLogo } from "../StockLogo";

describe("StockLogo", () => {
  it("serves the mark from this site, keyed by ticker", () => {
    const { container } = render(<StockLogo koreanTicker="005930" />);
    const img = container.querySelector("img")!;

    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toContain("logos/005930.png");
    expect(img.getAttribute("src")).not.toMatch(/^https?:/);
  });

  it("stays silent: the card's own text names the company", () => {
    render(<StockLogo koreanTicker="000660" />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders nothing for a listing with no file", () => {
    const { container } = render(<StockLogo koreanTicker="000000" />);
    expect(container).toBeEmptyDOMElement();
  });

  /*
   * The two Samsung listings carry different marks — 삼성전기 has its own
   * SAMSUNG ELECTRO-MECHANICS lockup — so the cards cannot be told apart by
   * name alone at a glance and must not be told apart by logo either.
   */
  it("gives each Samsung listing its own mark", () => {
    const samsung = render(<StockLogo koreanTicker="005930" />);
    const affiliate = render(<StockLogo koreanTicker="009150" />);

    const src = (r: typeof samsung) =>
      r.container.querySelector("img")!.getAttribute("src");
    expect(src(affiliate)).not.toBe(src(samsung));
  });

  /*
   * A stacked lockup spends most of its height on things that are not letters,
   * so matching a wordmark's height would render it visibly smaller. The
   * per-mark heights live in src/config/logos.ts.
   */
  it("gives a stacked lockup more height than a wordmark", () => {
    const wordmark = render(<StockLogo koreanTicker="005930" />);
    const lockup = render(<StockLogo koreanTicker="000660" />);

    const height = (r: typeof wordmark) =>
      parseFloat(
        r.container.querySelector("img")!.style.getPropertyValue("--mark-h")
      );
    expect(height(lockup)).toBeGreaterThan(height(wordmark));
  });

  it("sizes by height and lets width follow", () => {
    const { container } = render(<StockLogo koreanTicker="005380" />);
    const img = container.querySelector("img")!;

    expect(img.className).toContain("w-auto");
    expect(img.className).toContain("object-contain");
    expect(img.style.getPropertyValue("--mark-h")).toMatch(/px$/);
  });
});
