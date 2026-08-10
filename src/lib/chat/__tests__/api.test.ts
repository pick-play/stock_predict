import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CHAT_API_BASE,
  chatSocketUrl,
  clearCachedTicket,
  isChatConfigured,
  loadCachedTicket,
  requestChatTicket,
  storeTicket,
} from "../api";
import { ChatApiError } from "../../../types/chat";
import { formatChatTime } from "../formatChatTime";

// ─── Config ───────────────────────────────────────────────────────────────────

describe("chat api config", () => {
  it("is unconfigured when VITE_BOARD_API_BASE is absent", () => {
    // Same env var as the board: one Worker serves both.
    expect(isChatConfigured).toBe(false);
    expect(CHAT_API_BASE).toBe("");
  });

  it("returns no socket URL while unconfigured", () => {
    expect(chatSocketUrl("t")).toBeNull();
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
  it("renders HH:mm in Asia/Seoul", () => {
    // 2026-08-10T02:05:00Z is 11:05 KST.
    expect(formatChatTime("2026-08-10T02:05:00.000Z")).toBe("11:05");
  });

  it("does not render seconds", () => {
    expect(formatChatTime("2026-08-10T02:05:42.000Z")).toBe("11:05");
  });

  it("falls back to a placeholder for an invalid timestamp", () => {
    expect(formatChatTime("not-a-date")).toBe("--:--");
  });
});
