import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNow } from "../useNow";

const START = new Date("2026-08-02T12:00:00.000Z");

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current date on mount", () => {
    const { result } = renderHook(() => useNow());
    expect(result.current).toEqual(START);
  });

  it("ticks every second when page is visible", () => {
    const { result } = renderHook(() => useNow());

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toEqual(new Date("2026-08-02T12:00:01.000Z"));

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toEqual(new Date("2026-08-02T12:00:02.000Z"));
  });

  it("pauses ticking when page is hidden", () => {
    const { result } = renderHook(() => useNow());

    setVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // Should not have advanced — still at START
    expect(result.current).toEqual(START);
  });

  it("immediately updates and resumes ticking when page becomes visible again", () => {
    const { result } = renderHook(() => useNow());

    // Go hidden
    setVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Advance time while hidden
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // Come back visible
    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Should have jumped to current time immediately
    expect(result.current).toEqual(new Date("2026-08-02T12:00:05.000Z"));

    // And continue ticking
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toEqual(new Date("2026-08-02T12:00:06.000Z"));
  });

  it("cleans up interval on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});

/**
 * The clock is shared, and coarse callers stay coarse.
 *
 * Before this, every consumer owned an interval and re-rendered its subtree once
 * a second. On the dashboard that was five timers and five subtree renders per
 * second, forever — measurable as heat on a phone.
 */
describe("useNow sharing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs one interval however many components ask for the time", () => {
    const spy = vi.spyOn(window, "setInterval");

    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    const c = renderHook(() => useNow(30_000));

    expect(spy).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
    c.unmount();
    spy.mockRestore();
  });

  /*
   * Asserted by observing that the next consumer has to start a fresh interval.
   * Spying on clearInterval itself breaks the fake-timer clock for every test
   * that follows, which is a worse trade than checking the effect.
   */
  it("stops the interval once the last consumer leaves", () => {
    renderHook(() => useNow()).unmount();

    const spy = vi.spyOn(window, "setInterval");
    const next = renderHook(() => useNow());
    expect(spy).toHaveBeenCalledTimes(1);

    next.unmount();
    spy.mockRestore();
  });

  /*
   * One second at a time, each in its own act(). Advancing the whole span inside
   * a single act() would batch every state update into one render and make both
   * resolutions look identical — the test would pass whatever the code did.
   */
  function rendersOver(seconds: number, resolutionMs?: number): number {
    let renders = 0;
    const view = renderHook(() => {
      renders += 1;
      return useNow(resolutionMs);
    });

    const initial = renders;
    for (let i = 0; i < seconds; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
    }
    view.unmount();
    return renders - initial;
  }

  it("wakes a 30s consumer twice a minute, not sixty times", () => {
    expect(rendersOver(60, 30_000)).toBe(2);
  });

  it("still gives a 1s consumer every second", () => {
    expect(rendersOver(5)).toBe(5);
  });

  // A label frozen while the tab was hidden is wrong the instant it is seen.
  it("catches up when the tab comes back", () => {
    const { result } = renderHook(() => useNow(30_000));

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(120_000);
    });

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.getTime()).toBe(START.getTime() + 120_000);
  });
});
