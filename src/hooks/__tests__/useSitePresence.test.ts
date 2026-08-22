/**
 * The ping's cost rules, which are the only thing about it worth pinning.
 *
 * Every ping is one Durable Object request from every visitor, so the two
 * things that keep it affordable — a hidden tab is silent, and the interval is
 * a minute — are load-bearing rather than incidental.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CHAT_PRESENCE_PING_MS } from "../../lib/chat/config";

/*
 * The API base comes from an env var, and CI has no .env.
 *
 * Without this the hook returns early on `isChatConfigured`, every assertion
 * below reads zero calls, and the suite passes locally while failing on the
 * runner — which is exactly how it failed once already. Mocked at the network
 * boundary only: the hook's own timing and visibility logic still runs.
 */
vi.mock("../../lib/chat/api", () => ({
  isChatConfigured: true,
  CHAT_API_BASE: "https://api.test",
}));

const { useSitePresence } = await import("../useSitePresence");

const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useSitePresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("announces the tab once on arrival", () => {
    renderHook(() => useSitePresence());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/api/chat/presence");
    // POST: a GET that changes what the room reports is something a prefetcher
    // would fire on its own.
    expect(init.method).toBe("POST");
  });

  it("keeps to its interval rather than polling", () => {
    renderHook(() => useSitePresence());
    fetchMock.mockClear();

    vi.advanceTimersByTime(CHAT_PRESENCE_PING_MS * 3);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("says nothing from a tab nobody is looking at", () => {
    setVisibility("hidden");
    renderHook(() => useSitePresence());
    fetchMock.mockClear();

    vi.advanceTimersByTime(CHAT_PRESENCE_PING_MS * 5);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops when the app unmounts", () => {
    const { unmount } = renderHook(() => useSitePresence());
    unmount();
    fetchMock.mockClear();

    vi.advanceTimersByTime(CHAT_PRESENCE_PING_MS * 3);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
