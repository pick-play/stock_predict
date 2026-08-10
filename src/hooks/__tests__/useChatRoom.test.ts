/**
 * Reconnect behaviour for the chat socket.
 *
 * Written for one regression above all: with the join gate removed, an expired
 * ticket used to leave the hook parked forever with no button to press, so the
 * room died after thirty minutes and only a reload brought it back.
 *
 * WebSocket, sessionStorage and the ticket endpoint are all faked, because the
 * behaviour under test is entirely about what the hook does with timers and
 * close events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { CHAT_RECONNECT_DELAYS_MS } from "../../lib/chat/config";

const NOW = 1_786_000_000_000;

const api = vi.hoisted(() => ({
  requestChatTicket: vi.fn(),
  cached: null as { ticket: string; expiresAt: string } | null,
  stored: [] as { ticket: string; expiresAt: string }[],
  cleared: 0,
}));

vi.mock("../../lib/chat/api", () => ({
  isChatConfigured: true,
  chatSocketUrl: (ticket: string) => `wss://example.invalid/room?ticket=${ticket}`,
  requestChatTicket: api.requestChatTicket,
  loadCachedTicket: () => api.cached,
  storeTicket: (t: { ticket: string; expiresAt: string }) => {
    api.stored.push(t);
  },
  clearCachedTicket: () => {
    api.cleared += 1;
  },
}));

/** Minimal stand-in that records instances and lets a test drive close(). */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  drop() {
    this.readyState = 3;
    this.onclose?.();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }
}

const { useChatRoom } = await import("../useChatRoom");

function ticket(offsetMs: number) {
  return {
    ticket: `t-${offsetMs}`,
    expiresAt: new Date(NOW + offsetMs).toISOString(),
  };
}

describe("useChatRoom reconnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    FakeSocket.instances = [];
    api.requestChatTicket.mockReset();
    api.requestChatTicket.mockResolvedValue(ticket(30 * 60_000));
    api.cached = null;
    api.stored = [];
    api.cleared = 0;
    vi.stubGlobal("WebSocket", FakeSocket as unknown as typeof WebSocket);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // No gate any more, so mounting must fetch a ticket by itself.
  it("joins automatically without a cached ticket", async () => {
    renderHook(() => useChatRoom());
    await act(async () => {});

    expect(api.requestChatTicket).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("uses a cached ticket without asking for a new one", async () => {
    api.cached = ticket(10 * 60_000);
    renderHook(() => useChatRoom());
    await act(async () => {});

    expect(api.requestChatTicket).not.toHaveBeenCalled();
    expect(FakeSocket.instances[0].url).toContain("t-600000");
  });

  it("reports the room open once the socket opens", async () => {
    const { result } = renderHook(() => useChatRoom());
    await act(async () => {});
    await act(async () => FakeSocket.instances[0].open());

    expect(result.current.status).toBe("open");
  });

  it("retries with the same ticket while it is still valid", async () => {
    const { result } = renderHook(() => useChatRoom());
    await act(async () => {});
    await act(async () => FakeSocket.instances[0].open());
    await act(async () => FakeSocket.instances[0].drop());

    expect(result.current.status).toBe("reconnecting");

    await act(async () => {
      vi.advanceTimersByTime(CHAT_RECONNECT_DELAYS_MS[0]);
    });

    expect(FakeSocket.instances).toHaveLength(2);
    expect(api.requestChatTicket).toHaveBeenCalledOnce();
  });

  /*
   * The regression. Before the fix this settled on "gated" and stopped: no new
   * ticket, no new socket, and with the gate gone nothing a visitor could press.
   */
  it("fetches a fresh ticket when the held one has expired", async () => {
    api.cached = ticket(1_000);
    const { result } = renderHook(() => useChatRoom());
    await act(async () => {});
    await act(async () => FakeSocket.instances[0].open());

    // Walk past the ticket's expiry, then lose the socket.
    vi.setSystemTime(NOW + 2_000);
    await act(async () => FakeSocket.instances[0].drop());

    expect(result.current.status).toBe("reconnecting");
    expect(api.cleared).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(CHAT_RECONNECT_DELAYS_MS[0]);
    });
    await act(async () => {});

    expect(api.requestChatTicket).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(2);
    expect(result.current.status).not.toBe("gated");
  });

  it("does not spin when the ticket endpoint keeps failing", async () => {
    api.cached = ticket(1_000);
    api.requestChatTicket.mockRejectedValue(new Error("down"));
    renderHook(() => useChatRoom());
    await act(async () => {});
    await act(async () => FakeSocket.instances[0].open());

    vi.setSystemTime(NOW + 2_000);
    await act(async () => FakeSocket.instances[0].drop());

    await act(async () => {
      vi.advanceTimersByTime(CHAT_RECONNECT_DELAYS_MS[0]);
    });
    await act(async () => {});

    // One rejoin attempt, and no socket built from a ticket that never arrived.
    expect(api.requestChatTicket).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  describe("on returning to the tab", () => {
    function hide() {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
    }
    function show() {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
    }

    afterEach(show);

    it("reconnects at once instead of waiting out the backoff", async () => {
      api.cached = ticket(20 * 60_000);
      renderHook(() => useChatRoom());
      await act(async () => {});
      await act(async () => FakeSocket.instances[0].open());
      await act(async () => FakeSocket.instances[0].drop());

      // Mid-backoff: nothing has been rebuilt yet.
      expect(FakeSocket.instances).toHaveLength(1);

      show();
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(FakeSocket.instances).toHaveLength(2);
    });

    it("leaves a live socket alone but prods it", async () => {
      api.cached = ticket(20 * 60_000);
      renderHook(() => useChatRoom());
      await act(async () => {});
      await act(async () => FakeSocket.instances[0].open());

      show();
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // An extra socket here would cost the backlog round trip for nothing.
      expect(FakeSocket.instances).toHaveLength(1);
      expect(FakeSocket.instances[0].sent).toContain("ping");
    });

    it("ignores the event while the tab is still hidden", async () => {
      api.cached = ticket(20 * 60_000);
      renderHook(() => useChatRoom());
      await act(async () => {});
      await act(async () => FakeSocket.instances[0].open());
      await act(async () => FakeSocket.instances[0].drop());

      hide();
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(FakeSocket.instances).toHaveLength(1);
    });
  });
});
