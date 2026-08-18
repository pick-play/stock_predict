import { describe, it, expect } from "vitest";
import { ChatMessageStore, createMemoryChatStorage } from "../messageStore";
import type { ChatStorage } from "../messageStore";
import { CHAT_MESSAGE_CAP } from "../config";

function makeStore(cap?: number) {
  const storage = createMemoryChatStorage();
  return { storage, store: new ChatMessageStore(storage, cap) };
}

function line(n: number) {
  return {
    body: `메시지 ${n}`,
    handle: "차분한 강아지",
    createdAt: new Date(1_760_000_000_000 + n * 1_000).toISOString(),
  };
}

describe("ChatMessageStore append", () => {
  it("assigns sequential ids starting at 0", async () => {
    const { store } = makeStore(10);
    const first = await store.append(line(0));
    const second = await store.append(line(1));
    expect(first.id).toBe("0");
    expect(second.id).toBe("1");
  });

  it("returns the stored body, handle and timestamp unchanged", async () => {
    const { store } = makeStore(10);
    const input = line(7);
    const stored = await store.append(input);
    expect(stored.body).toBe(input.body);
    expect(stored.handle).toBe(input.handle);
    expect(stored.createdAt).toBe(input.createdAt);
  });

  it("reloads the sequence from storage after a cold start", async () => {
    const storage = createMemoryChatStorage();
    const first = new ChatMessageStore(storage, 10);
    await first.append(line(0));
    await first.append(line(1));

    // A hibernated room wakes with empty memory but the same storage.
    const revived = new ChatMessageStore(storage, 10);
    const next = await revived.append(line(2));
    expect(next.id).toBe("2");
    expect(await revived.count()).toBe(3);
  });
});

describe("ChatMessageStore 500-message cap", () => {
  it("keeps every message while below the cap", async () => {
    const { store } = makeStore(5);
    for (let i = 0; i < 5; i++) await store.append(line(i));
    expect(await store.count()).toBe(5);
  });

  it("evicts the oldest message once the cap is exceeded", async () => {
    const { store } = makeStore(3);
    for (let i = 0; i < 4; i++) await store.append(line(i));

    expect(await store.count()).toBe(3);
    const history = await store.history(10);
    expect(history.map((m) => m.body)).toEqual([
      "메시지 1",
      "메시지 2",
      "메시지 3",
    ]);
  });

  it("holds at exactly the cap over a long run", async () => {
    const { store } = makeStore(4);
    for (let i = 0; i < 40; i++) {
      await store.append(line(i));
      expect(await store.count()).toBeLessThanOrEqual(4);
    }
    expect(await store.count()).toBe(4);
    const history = await store.history(10);
    expect(history.map((m) => m.body)).toEqual([
      "메시지 36",
      "메시지 37",
      "메시지 38",
      "메시지 39",
    ]);
  });

  it("enforces the real 500 cap from config", async () => {
    const { store } = makeStore();
    for (let i = 0; i < CHAT_MESSAGE_CAP + 25; i++) await store.append(line(i));

    expect(await store.count()).toBe(CHAT_MESSAGE_CAP);
    const history = await store.history(CHAT_MESSAGE_CAP);
    expect(history).toHaveLength(CHAT_MESSAGE_CAP);
    expect(history[0].body).toBe("메시지 25");
    expect(history[history.length - 1].body).toBe(
      `메시지 ${CHAT_MESSAGE_CAP + 24}`
    );
  });

  it("evicts across a cold start, so a wake-up does not reset the window", async () => {
    const storage = createMemoryChatStorage();
    const first = new ChatMessageStore(storage, 3);
    for (let i = 0; i < 3; i++) await first.append(line(i));

    const revived = new ChatMessageStore(storage, 3);
    await revived.append(line(3));

    expect(await revived.count()).toBe(3);
    const history = await revived.history(10);
    expect(history[0].body).toBe("메시지 1");
  });

  it("serialises concurrent appends so no sequence number is reused", async () => {
    const { store } = makeStore(100);
    const written = await Promise.all(
      Array.from({ length: 25 }, (_, i) => store.append(line(i)))
    );

    const ids = written.map((m) => m.id);
    expect(new Set(ids).size).toBe(25);
    expect(await store.count()).toBe(25);
  });

  it("keeps the cap under concurrent appends", async () => {
    const { store } = makeStore(10);
    await Promise.all(
      Array.from({ length: 60 }, (_, i) => store.append(line(i)))
    );
    expect(await store.count()).toBe(10);
  });

  it("recovers the window when an eviction write fails midway", async () => {
    const backing = createMemoryChatStorage();
    let failNextPut = false;

    const flaky: ChatStorage = {
      get: (key) => backing.get(key),
      put: (entries) =>
        failNextPut
          ? Promise.reject(new Error("storage unavailable"))
          : backing.put(entries),
      delete: (keys) => backing.delete(keys),
      list: (options) => backing.list(options),
    };

    const store = new ChatMessageStore(flaky, 3);
    for (let i = 0; i < 3; i++) await store.append(line(i));

    // The eviction delete lands but the following write does not.
    failNextPut = true;
    await expect(store.append(line(3))).rejects.toThrow("storage unavailable");
    failNextPut = false;

    // A fresh instance re-reads the cursor, which still points at the deleted
    // range; the next append must absorb the gap rather than over-trim.
    const revived = new ChatMessageStore(flaky, 3);
    await revived.append(line(4));
    expect(await revived.count()).toBeLessThanOrEqual(3);
    const history = await revived.history(10);
    expect(history[history.length - 1].body).toBe("메시지 4");
  });
});

describe("ChatMessageStore history", () => {
  it("returns messages oldest first", async () => {
    const { store } = makeStore(10);
    for (let i = 0; i < 4; i++) await store.append(line(i));
    const history = await store.history(10);
    expect(history.map((m) => m.id)).toEqual(["0", "1", "2", "3"]);
  });

  it("returns only the newest entries when limited", async () => {
    const { store } = makeStore(10);
    for (let i = 0; i < 6; i++) await store.append(line(i));
    const history = await store.history(2);
    expect(history.map((m) => m.body)).toEqual(["메시지 4", "메시지 5"]);
  });

  it("never returns more than the cap even when a larger limit is asked for", async () => {
    const { store } = makeStore(3);
    for (let i = 0; i < 6; i++) await store.append(line(i));
    expect(await store.history(500)).toHaveLength(3);
  });

  it("is empty for a fresh room", async () => {
    const { store } = makeStore(10);
    expect(await store.history(10)).toEqual([]);
  });

  it("skips a corrupted row instead of failing the whole read", async () => {
    const { storage, store } = makeStore(10);
    await store.append(line(0));
    await store.append(line(1));
    storage.entries.set("chat:m:000000000001", { body: 42 });

    const history = await store.history(10);
    expect(history).toHaveLength(1);
    expect(history[0].body).toBe("메시지 0");
  });

  it("ignores an unrelated storage key", async () => {
    const { storage, store } = makeStore(10);
    await store.append(line(0));
    storage.entries.set("some:other:key", { body: "not a message" });
    expect(await store.count()).toBe(1);
  });
});

/**
 * Members joined the room after 500 messages had already been written without
 * the flag. Those rows are anonymous and must read that way rather than
 * disappearing or defaulting to "회원".
 */
describe("member flag", () => {
  it("stores whether the sender was a logged-in member", async () => {
    const storage = createMemoryChatStorage();
    const store = new ChatMessageStore(storage);

    await store.append({
      body: "회원입니다",
      handle: "국장의전설",
      isMember: true,
      createdAt: "2026-08-18T12:00:00.000Z",
    });
    await store.append({
      body: "익명입니다",
      handle: "느긋한 수달",
      createdAt: "2026-08-18T12:00:01.000Z",
    });

    const history = await store.history();
    expect(history[0].isMember).toBe(true);
    expect(history[1].isMember).toBe(false);
  });

  it("reads a row written before the flag existed as anonymous", async () => {
    const storage = createMemoryChatStorage();
    storage.entries.set("chat:m:000000000000", {
      body: "예전 메시지",
      handle: "느긋한 수달",
      createdAt: "2026-08-01T12:00:00.000Z",
    });

    const [message] = await new ChatMessageStore(storage).history();
    expect(message.handle).toBe("느긋한 수달");
    expect(message.isMember).toBe(false);
  });
});
