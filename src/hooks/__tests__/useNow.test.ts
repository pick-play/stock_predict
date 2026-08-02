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
