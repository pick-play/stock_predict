/**
 * The device setting has to stay authoritative.
 *
 * Before this, the first toggle wrote a preference that outlived any reason for
 * it: the site then ignored the phone switching to light for good, with no way
 * back short of clearing site data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "../useTheme";

const STORAGE_KEY = "kospinow:theme";

let listeners: Array<() => void> = [];
let systemPrefersLight = false;

function mockMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: query.includes("light") ? systemPrefersLight : !systemPrefersLight,
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    })
  );
}

/** Flip the OS setting and fire the change the browser would fire. */
function setSystem(light: boolean) {
  systemPrefersLight = light;
  listeners.forEach((cb) => cb());
}

describe("useTheme", () => {
  beforeEach(() => {
    listeners = [];
    systemPrefersLight = false;
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    mockMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("takes dark from a dark device", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("takes light from a light device", () => {
    systemPrefersLight = true;
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("follows the device changing while open", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");

    act(() => setSystem(true));
    expect(result.current.theme).toBe("light");
  });

  it("writes nothing until the reader asks for something else", () => {
    renderHook(() => useTheme());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("honours a stored choice over the device", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("stops following the device once overridden", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle()); // dark device, so this pins light
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");

    act(() => setSystem(true));
    expect(result.current.theme).toBe("light");
  });

  /*
   * The way back. Toggling to whatever the device already asks for clears the
   * override instead of pinning it, so two taps restore following the OS — the
   * only route that does not need a settings screen.
   */
  it("clears the override when the choice matches the device", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle()); // → light, pinned
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");

    act(() => result.current.toggle()); // → dark, which the device wants
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("follows the device again after the override is cleared", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    act(() => result.current.toggle()); // back to following

    act(() => setSystem(true));
    expect(result.current.theme).toBe("light");
  });

  it("stamps the resolved theme on the document", () => {
    systemPrefersLight = true;
    renderHook(() => useTheme());
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("survives storage being unavailable", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("private mode");
      });

    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());

    // The choice still holds for the session even though it could not be saved.
    expect(result.current.theme).toBe("light");
    setItem.mockRestore();
  });
});
