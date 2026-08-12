import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearCachedTicket,
  loadCachedTicket,
  requestChatTicket,
  storeTicket,
} from "../api";
import { ChatApiError } from "../../../types/chat";
import { formatChatTime } from "../formatChatTime";

// ─── Config ───────────────────────────────────────────────────────────────────

/* Same reasoning as the board's config tests: stub the variable rather than
 * depend on the developer not having a .env. */
async function loadChatApi(base: string) {
  vi.resetModules();
  vi.stubEnv("VITE_BOARD_API_BASE", base);
  return import("../api");
}

describe("chat api config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is unconfigured when VITE_BOARD_API_BASE is empty", async () => {
    // Same env var as the board: one Worker serves both.
    const api = await loadChatApi("");
    expect(api.isChatConfigured).toBe(false);
    expect(api.CHAT_API_BASE).toBe("");
  });

  it("returns no socket URL while unconfigured", async () => {
    const api = await loadChatApi("");
    expect(api.chatSocketUrl("t")).toBeNull();
  });

  // The socket shares the Worker's host, so the scheme has to be swapped.
  it("builds a wss URL from an https base", async () => {
    const api = await loadChatApi("https://worker.example.com");
    expect(api.chatSocketUrl("abc")).toBe(
      "wss://worker.example.com/api/chat/room?ticket=abc"
    );
  });
});

// ─── requestChatTicket ────────────────────────────────────────────────────────

describe("requestChatTicket", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the ticket on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ticket: "c1.123.abcd",
          expiresAt: "2026-08-10T01:00:00.000Z",
        }),
    } as Response);

    const ticket = await requestChatTicket("token");
    expect(ticket.ticket).toBe("c1.123.abcd");
  });

  it("sends the Turnstile token in the body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ ticket: "t", expiresAt: "2026-08-10T01:00:00.000Z" }),
    } as Response);

    await requestChatTicket("captcha-token");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent.turnstileToken).toBe("captcha-token");
  });

  it("throws kind=captcha-failed on 403", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: "captcha-failed",
          message: "CAPTCHA 검증에 실패했습니다.",
        }),
    } as Response);

    await expect(requestChatTicket("bad")).rejects.toMatchObject({
      kind: "captcha-failed",
    });
  });

  it("throws kind=unavailable when the room is not deployed", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({
          error: "chat-unavailable",
          message: "채팅방을 준비 중입니다.",
        }),
    } as Response);

    await expect(requestChatTicket("t")).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("throws kind=network on a transport failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    await expect(requestChatTicket("t")).rejects.toBeInstanceOf(ChatApiError);
    await expect(requestChatTicket("t")).rejects.toMatchObject({
      kind: "network",
    });
  });
});

// ─── Ticket cache ─────────────────────────────────────────────────────────────

describe("ticket cache", () => {
  afterEach(() => {
    clearCachedTicket();
  });

  it("round-trips an unexpired ticket", () => {
    const now = Date.UTC(2026, 7, 10, 0, 0, 0);
    storeTicket({
      ticket: "c1.1.aa",
      expiresAt: new Date(now + 60_000).toISOString(),
    });
    expect(loadCachedTicket(now)?.ticket).toBe("c1.1.aa");
  });

  it("discards a ticket that has already expired", () => {
    const now = Date.UTC(2026, 7, 10, 0, 0, 0);
    storeTicket({
      ticket: "c1.1.aa",
      expiresAt: new Date(now - 1).toISOString(),
    });
    expect(loadCachedTicket(now)).toBeNull();
  });

  it("returns null when nothing is cached", () => {
    expect(loadCachedTicket()).toBeNull();
  });

  it("returns null for a malformed cache entry", () => {
    window.sessionStorage.setItem("kospinow.chat.ticket", "{not json");
    expect(loadCachedTicket()).toBeNull();
  });
});

// ─── formatChatTime ───────────────────────────────────────────────────────────

describe("formatChatTime", () => {
  /** 2026-08-10T02:05:00Z is 11:05 KST. */
  const SENT = "2026-08-10T02:05:00.000Z";
  const at = (offsetMs: number) => new Date(Date.parse(SENT) + offsetMs);

  it("renders HH:mm in Asia/Seoul once the line is over an hour old", () => {
    expect(formatChatTime(SENT, at(60 * 60_000))).toBe("11:05");
  });

  it("does not render seconds", () => {
    expect(formatChatTime("2026-08-10T02:05:42.000Z", at(3 * 60 * 60_000))).toBe(
      "11:05"
    );
  });

  it("falls back to a placeholder for an invalid timestamp", () => {
    expect(formatChatTime("not-a-date")).toBe("--:--");
  });

  // The first minute reads as 방금: a reader wants to know whether the line just
  // landed, and "0분 전" answers that awkwardly.
  it("says 방금 inside the first minute", () => {
    expect(formatChatTime(SENT, at(0))).toBe("방금");
    expect(formatChatTime(SENT, at(59_000))).toBe("방금");
  });

  it("counts minutes for the rest of the hour", () => {
    expect(formatChatTime(SENT, at(60_000))).toBe("1분 전");
    expect(formatChatTime(SENT, at(90_000))).toBe("1분 전");
    expect(formatChatTime(SENT, at(30 * 60_000))).toBe("30분 전");
    expect(formatChatTime(SENT, at(59 * 60_000 + 59_000))).toBe("59분 전");
  });

  // A reader whose clock runs behind the server's would otherwise be told the
  // message arrives in the future.
  it("treats a timestamp ahead of the reader's clock as 방금", () => {
    expect(formatChatTime(SENT, at(-5 * 60_000))).toBe("방금");
  });
});
