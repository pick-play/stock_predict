import "@testing-library/jest-dom";

/**
 * jsdom has no ResizeObserver, and no layout either.
 *
 * The chart measures its container to draw at real pixel widths (upright axis
 * labels cannot come from a stretched viewBox). Under jsdom every element is
 * 0×0, so without this the chart would render nothing and its tests would pass
 * by measuring an empty box. The stub reports one fixed width, which is all the
 * geometry needs to be exercised.
 */
const TEST_ELEMENT_WIDTH = 640;

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: TEST_ELEMENT_WIDTH, height: 224 },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
