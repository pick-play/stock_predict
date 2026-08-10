import { describe, it, expect } from "vitest";
import { HANDLE_ADJECTIVES, HANDLE_NOUNS } from "../handleWords";
import {
  appendWithCap,
  chatHandleFromIpHash,
  evaluateChatRate,
  isChatMessage,
  parseChatClientEvent,
  validateChatMessage,
  isAtSocketLimit,
} from "../rules";
import {
  CHAT_MAX_SOCKETS_PER_IP,
  CHAT_MESSAGE_CAP,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_RATE_WINDOW_MAX,
  CHAT_RATE_WINDOW_MS,
  CHAT_SEND_MIN_INTERVAL_MS,
} from "../config";

// ─── validateChatMessage ──────────────────────────────────────────────────────

describe("validateChatMessage", () => {
  it("accepts an ordinary line and returns the trimmed body", () => {
    const result = validateChatMessage("  오늘 삼전 흐름 어떤가요  ");
    expect(result.ok).toBe(true);
    expect(result.body).toBe("오늘 삼전 흐름 어떤가요");
  });

  it("rejects a non-string frame body", () => {
    const result = validateChatMessage(42);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid");
  });

  it("rejects an empty body", () => {
    const result = validateChatMessage("");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("empty");
  });

  it("rejects a whitespace-only body", () => {
    const result = validateChatMessage("   \n\t  ");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("empty");
  });

  it("rejects a body longer than the chat limit", () => {
    const result = validateChatMessage("가".repeat(CHAT_MESSAGE_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("too-long");
    expect(result.message).toContain(String(CHAT_MESSAGE_MAX_LENGTH));
  });

  it("accepts a body exactly at the limit", () => {
    // Alternating characters: a single repeated character would trip the shared
    // filter's repetition rule before the length rule ever mattered.
    const result = validateChatMessage("가나".repeat(CHAT_MESSAGE_MAX_LENGTH / 2));
    expect(result.ok).toBe(true);
  });

  it("rejects a long run of the same character", () => {
    const result = validateChatMessage("ㅋ".repeat(40));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rejected");
  });

  it("reports the chat limit, not the board limit, for a long paste", () => {
    // The shared filter allows 1,000 characters; a chat sender must never be
    // shown that number.
    const result = validateChatMessage("가".repeat(900));
    expect(result.code).toBe("too-long");
    expect(result.message).not.toContain("1000");
  });

  it("rejects profanity through the shared moderation filter", () => {
    const result = validateChatMessage("이런 씨발 진짜");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rejected");
    expect(result.message).toContain("욕설");
  });

  it("rejects initial-consonant profanity evasions", () => {
    const result = validateChatMessage("ㅅㅂ 물렸다");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rejected");
  });

  it("rejects advertising solicitations", () => {
    const result = validateChatMessage("수익보장 리딩방 들어오세요");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rejected");
  });

  it("rejects contact details", () => {
    const result = validateChatMessage("연락주세요 010-1234-5678");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rejected");
  });
});

// ─── parseChatClientEvent ─────────────────────────────────────────────────────

describe("parseChatClientEvent", () => {
  it("parses a well-formed message frame", () => {
    expect(parseChatClientEvent('{"type":"message","body":"안녕하세요"}')).toEqual({
      type: "message",
      body: "안녕하세요",
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseChatClientEvent("not json")).toBeNull();
  });

  it("returns null for an unknown frame type", () => {
    expect(parseChatClientEvent('{"type":"kick","body":"x"}')).toBeNull();
  });

  it("returns null when the body is not a string", () => {
    expect(parseChatClientEvent('{"type":"message","body":123}')).toBeNull();
  });

  it("ignores client-supplied identity fields", () => {
    const parsed = parseChatClientEvent(
      '{"type":"message","body":"hi","handle":"관리자","id":"1"}'
    );
    expect(parsed).toEqual({ type: "message", body: "hi" });
  });
});

// ─── chatHandleFromIpHash ─────────────────────────────────────────────────────

describe("chatHandleFromIpHash", () => {
  it("pairs an adjective with a noun", () => {
    expect(chatHandleFromIpHash("a3f2bc9900112233")).toBe("차분한 강아지");
  });

  // A name that changed between messages would make a conversation impossible
  // to follow, so the same hash must always give the same name.
  it("is stable for the same hash", () => {
    const first = chatHandleFromIpHash("77aa11bb99cc0011");
    const second = chatHandleFromIpHash("77aa11bb99cc0011");
    expect(first).toBe(second);
  });

  it("varies with the hash", () => {
    const a = chatHandleFromIpHash("0000000000000000");
    const b = chatHandleFromIpHash("ffffffffffffffff");
    expect(a).not.toBe(b);
  });

  it("does not reuse the retired board 익명 prefix", () => {
    expect(chatHandleFromIpHash("a3f2bc99")).not.toContain("익명");
  });

  it("has no hash digits left in the name", () => {
    expect(chatHandleFromIpHash("a3f2bc9900112233")).not.toMatch(/[0-9a-f]{4}/);
  });

  // A malformed hash should cost a dull name, not a failed join.
  it("still produces a usable name from a short hash", () => {
    const handle = chatHandleFromIpHash("ab");
    expect(handle).toBe("부지런한 고양이");
    expect(handle.split(" ")).toHaveLength(2);
  });

  it("draws from both full word lists", () => {
    expect(HANDLE_ADJECTIVES.length).toBeGreaterThanOrEqual(40);
    expect(HANDLE_NOUNS.length).toBeGreaterThanOrEqual(40);
    // Every entry must be a single token, or the two-word split above breaks.
    for (const word of [...HANDLE_ADJECTIVES, ...HANDLE_NOUNS]) {
      expect(word).not.toContain(" ");
      expect(word.length).toBeGreaterThan(0);
    }
  });
});

// ─── evaluateChatRate ─────────────────────────────────────────────────────────

describe("evaluateChatRate", () => {
  const now = 1_760_000_000_000;

  it("allows the first message and records it", () => {
    const verdict = evaluateChatRate([], now);
    expect(verdict.allowed).toBe(true);
    expect(verdict.retryAfterMs).toBe(0);
    expect(verdict.history).toEqual([now]);
  });

  it("blocks a second message inside the minimum interval", () => {
    const verdict = evaluateChatRate([now - 500], now);
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterMs).toBe(CHAT_SEND_MIN_INTERVAL_MS - 500);
  });

  it("allows again once the minimum interval has passed", () => {
    const verdict = evaluateChatRate(
      [now - CHAT_SEND_MIN_INTERVAL_MS],
      now
    );
    expect(verdict.allowed).toBe(true);
  });

  it("blocks once the window cap is reached", () => {
    // Spread far enough apart that the interval rule is satisfied.
    const history = Array.from(
      { length: CHAT_RATE_WINDOW_MAX },
      (_, i) => now - CHAT_SEND_MIN_INTERVAL_MS - i * 3_000
    );
    const verdict = evaluateChatRate(history, now);
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterMs).toBeGreaterThan(0);
  });

  it("drops timestamps that fell out of the window", () => {
    const stale = Array.from(
      { length: CHAT_RATE_WINDOW_MAX },
      () => now - CHAT_RATE_WINDOW_MS - 1
    );
    const verdict = evaluateChatRate(stale, now);
    expect(verdict.allowed).toBe(true);
    expect(verdict.history).toEqual([now]);
  });

  it("never lets the history grow past the window cap", () => {
    let history: number[] = [];
    let clock = now;
    for (let i = 0; i < 200; i++) {
      clock += CHAT_SEND_MIN_INTERVAL_MS;
      history = evaluateChatRate(history, clock).history;
    }
    expect(history.length).toBeLessThanOrEqual(CHAT_RATE_WINDOW_MAX);
  });
});

// ─── appendWithCap ────────────────────────────────────────────────────────────

describe("appendWithCap", () => {
  it("appends below the cap", () => {
    expect(appendWithCap([1, 2], 3, 5)).toEqual([1, 2, 3]);
  });

  it("drops the oldest entry once the cap is exceeded", () => {
    expect(appendWithCap([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it("keeps exactly the newest cap entries after many appends", () => {
    let window: number[] = [];
    for (let i = 0; i < CHAT_MESSAGE_CAP + 120; i++) {
      window = appendWithCap(window, i, CHAT_MESSAGE_CAP);
    }
    expect(window).toHaveLength(CHAT_MESSAGE_CAP);
    expect(window[0]).toBe(120);
    expect(window[window.length - 1]).toBe(CHAT_MESSAGE_CAP + 119);
  });

  it("returns an empty window for a non-positive cap", () => {
    expect(appendWithCap([1, 2], 3, 0)).toEqual([]);
  });
});

// ─── isChatMessage ────────────────────────────────────────────────────────────

describe("isChatMessage", () => {
  it("accepts a complete server message", () => {
    expect(
      isChatMessage({
        id: "1",
        body: "hi",
        handle: "차분한 강아지",
        createdAt: "2026-08-10T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("rejects a message missing a field", () => {
    expect(isChatMessage({ id: "1", body: "hi", handle: "차분한 강아지" })).toBe(
      false
    );
  });

  it("rejects a non-object", () => {
    expect(isChatMessage("hi")).toBe(false);
    expect(isChatMessage(null)).toBe(false);
  });
});

// ─── isAtSocketLimit ─────────────────────────────────────────────────────────

describe("isAtSocketLimit", () => {
  /*
   * This cap replaced the entry CAPTCHA, so its boundary carries weight both
   * ways: one too low locks a reader out of a second tab, one too high hands a
   * script another connection.
   */
  it("allows connections below the cap", () => {
    expect(isAtSocketLimit(0)).toBe(false);
    expect(isAtSocketLimit(CHAT_MAX_SOCKETS_PER_IP - 1)).toBe(false);
  });

  it("refuses once the cap is reached", () => {
    expect(isAtSocketLimit(CHAT_MAX_SOCKETS_PER_IP)).toBe(true);
  });

  it("refuses above the cap", () => {
    expect(isAtSocketLimit(CHAT_MAX_SOCKETS_PER_IP + 5)).toBe(true);
  });

  /*
   * An office, a café, a school and a mobile carrier behind CGNAT each present
   * one public IP. A cap sized for "a couple of tabs" refuses real people, so
   * the floor here is a plausible group, not a plausible device count.
   */
  it("leaves room for a group sharing one address", () => {
    expect(CHAT_MAX_SOCKETS_PER_IP).toBeGreaterThanOrEqual(20);
  });
});
