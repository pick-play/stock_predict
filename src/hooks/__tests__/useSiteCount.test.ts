/**
 * The count poll, which every visible tab runs every few seconds.
 *
 * Two things keep it affordable and one keeps it honest: a hidden tab reads
 * nothing, the interval is what the owner asked for rather than whatever a
 * render loop produces, and a failed read leaves the last number alone instead
 * of blinking it to zero.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CHAT_PRESENCE_POLL_MS } from "../../lib/chat/config";

vi.mock("../../lib/chat/api", () => ({
  isChatConfigured: true,
  CHAT_API_BASE: "https://api.test",
}));

const published = vi.hoisted(() => ({ values: [] as number[] }));
vi.mock("../../lib/chat/livePreview", () => ({
  publishParticipants: (n: number) => published.values.push(n),
}));

const { useSiteCount } = await import("../useSiteCount");

const reply = (participants: number) =>
  Promise.resolve(
    new Response(JSON.stringify({ participants }), {
      headers: { "Content-Type": "application/json" },
    })
  );

// Typed so `mock.calls[0]` is a tuple the test can index; a bare `vi.fn(() =>
// …)` records calls as `[]`.
const fetchMock = vi.fn<(url: string) => Promise<Response>>(() => reply(7));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useSiteCount", () => {
  beforeEach(() => {
    published.values = [];
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("publishes the count it reads", async () => {
    renderHook(() => useSiteCount());
    await vi.waitFor(() => expect(published.values).toEqual([7]));

    expect(fetchMock.mock.calls[0][0]).toContain("/api/chat/count");
  });

  it("keeps to its interval", async () => {
    vi.useFakeTimers();
    renderHook(() => useSiteCount());
    fetchMock.mockClear();

    await vi.advanceTimersByTimeAsync(CHAT_PRESENCE_POLL_MS * 3);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reads nothing from a tab nobody is looking at", async () => {
    vi.useFakeTimers();
    setVisibility("hidden");
    renderHook(() => useSiteCount());
    fetchMock.mockClear();

    await vi.advanceTimersByTimeAsync(CHAT_PRESENCE_POLL_MS * 4);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves the last number alone when a read fails", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    renderHook(() => useSiteCount());

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(published.values).toEqual([]);
  });
});
