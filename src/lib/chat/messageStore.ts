/**
 * The room's message log and its 500-message rolling window.
 *
 * Lives in the shared tree rather than under worker/ for the same reason
 * moderation/filter.ts does: it is the authoritative rule and it has to be unit
 * tested by the repo's single Vitest project. The storage dependency is an
 * injected interface, so nothing here imports a Cloudflare type.
 *
 * Storage layout:
 *   chat:m:<12-digit sequence>  → StoredMessage
 *   chat:cursor                 → { oldestSeq, nextSeq }
 *
 * Zero-padded keys make lexicographic order the same as numeric order, so the
 * backlog read is one prefix list instead of a fan-out of gets. The cursor makes
 * eviction O(1) per message — counting keys on every send would grow with the
 * window size.
 */

import type { ChatMessage } from "../../types/chat";
import { CHAT_HISTORY_LIMIT, CHAT_MESSAGE_CAP } from "./config";

const CURSOR_KEY = "chat:cursor";
const MESSAGE_KEY_PREFIX = "chat:m:";
const SEQUENCE_KEY_WIDTH = 12;

export interface ChatStorageListOptions {
  prefix: string;
  limit?: number;
  reverse?: boolean;
}

/**
 * The slice of Durable Object storage this store needs. Values come back as
 * `unknown` so the store owns the narrowing instead of trusting a cast.
 */
export interface ChatStorage {
  get(key: string): Promise<unknown>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
  list(options: ChatStorageListOptions): Promise<Map<string, unknown>>;
}

export interface ChatMessageInput {
  body: string;
  handle: string;
  createdAt: string;
}

interface StoredMessage {
  body: string;
  handle: string;
  createdAt: string;
}

interface Cursor {
  /** Lowest sequence number that may still be stored. */
  oldestSeq: number;
  /** Sequence number the next message will take. */
  nextSeq: number;
}

function messageKey(seq: number): string {
  return MESSAGE_KEY_PREFIX + String(seq).padStart(SEQUENCE_KEY_WIDTH, "0");
}

function seqFromKey(key: string): string {
  // Strip the zero padding so ids read as plain numbers on the wire.
  return String(Number(key.slice(MESSAGE_KEY_PREFIX.length)));
}

function toStoredMessage(value: unknown): StoredMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const { body, handle, createdAt } = candidate;
  if (
    typeof body !== "string" ||
    typeof handle !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return { body, handle, createdAt };
}

function toCursor(value: unknown): Cursor | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const { oldestSeq, nextSeq } = candidate;
  if (
    typeof oldestSeq !== "number" ||
    typeof nextSeq !== "number" ||
    !Number.isInteger(oldestSeq) ||
    !Number.isInteger(nextSeq) ||
    oldestSeq < 0 ||
    nextSeq < oldestSeq
  ) {
    return null;
  }
  return { oldestSeq, nextSeq };
}

export class ChatMessageStore {
  private cursor: Cursor | null = null;

  /** Tail of the append chain — see append() for why this exists. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: ChatStorage,
    private readonly cap: number = CHAT_MESSAGE_CAP
  ) {}

  /**
   * Appends one message and enforces the cap.
   *
   * Serialised through a promise chain because a Durable Object is
   * single-threaded but not single-tasked: two socket messages arriving close
   * together both suspend at their first await, and without the chain both
   * would read the same nextSeq and one line would overwrite the other.
   */
  append(input: ChatMessageInput): Promise<ChatMessage> {
    const run = this.tail
      .catch(() => undefined)
      .then(() => this.appendSerialised(input));
    // Keep the chain alive after a failed append so one error does not wedge
    // the room; the rejection is still delivered to this caller.
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async appendSerialised(input: ChatMessageInput): Promise<ChatMessage> {
    const cursor = await this.loadCursor();
    const seq = cursor.nextSeq;

    const overflow = seq + 1 - cursor.oldestSeq - this.cap;
    if (overflow > 0) {
      const doomed: string[] = [];
      for (let s = cursor.oldestSeq; s < cursor.oldestSeq + overflow; s++) {
        doomed.push(messageKey(s));
      }
      // Evict before writing. If this throws, nothing has moved and the sender
      // gets an error to retry. If it succeeds but the write below throws, the
      // cursor still points at the deleted range, so the next append recomputes
      // a larger overflow and deletes the (already absent) keys again — the
      // range start absorbs the gap, so the arithmetic stays correct.
      await this.storage.delete(doomed);
    }

    const stored: StoredMessage = {
      body: input.body,
      handle: input.handle,
      createdAt: input.createdAt,
    };
    const nextCursor: Cursor = {
      oldestSeq: overflow > 0 ? cursor.oldestSeq + overflow : cursor.oldestSeq,
      nextSeq: seq + 1,
    };

    await this.storage.put({
      [messageKey(seq)]: stored,
      [CURSOR_KEY]: nextCursor,
    });
    this.cursor = nextCursor;

    return { id: String(seq), ...stored };
  }

  /** Newest `limit` messages in render order (oldest first). */
  async history(limit: number = CHAT_HISTORY_LIMIT): Promise<ChatMessage[]> {
    const wanted = Math.max(1, Math.min(limit, this.cap));
    const rows = await this.storage.list({
      prefix: MESSAGE_KEY_PREFIX,
      reverse: true,
      limit: wanted,
    });

    const newestFirst: ChatMessage[] = [];
    for (const [key, value] of rows) {
      const stored = toStoredMessage(value);
      // A row that fails the guard is skipped rather than thrown on: one bad
      // record must not stop the whole room from loading.
      if (stored) newestFirst.push({ id: seqFromKey(key), ...stored });
    }

    return newestFirst.reverse();
  }

  /**
   * Deletes the given ids and reports which ones actually existed.
   *
   * The cursor is left alone on purpose. It tracks the *span* of sequence
   * numbers, not the count, so a hole punched in the middle means the window
   * holds slightly fewer than the cap until the span rolls past it. Rewriting
   * oldestSeq here would be wrong in the other direction — deleting the oldest
   * line would then let the window grow past the cap.
   */
  async remove(ids: string[]): Promise<string[]> {
    const wanted = new Set<string>();
    for (const id of ids) {
      const seq = Number(id);
      if (Number.isInteger(seq) && seq >= 0) wanted.add(messageKey(seq));
    }
    if (wanted.size === 0) return [];

    const rows = await this.storage.list({ prefix: MESSAGE_KEY_PREFIX });
    const doomed = [...rows.keys()].filter((key) => wanted.has(key));
    if (doomed.length > 0) await this.storage.delete(doomed);

    return doomed.map(seqFromKey);
  }

  /**
   * Deletes every retained line from one handle — the whole-run case, for when a
   * single sender fills the room rather than posting once.
   */
  async removeByHandle(handle: string): Promise<string[]> {
    if (handle === "") return [];

    const rows = await this.storage.list({ prefix: MESSAGE_KEY_PREFIX });
    const doomed: string[] = [];
    for (const [key, value] of rows) {
      const stored = toStoredMessage(value);
      if (stored?.handle === handle) doomed.push(key);
    }
    if (doomed.length > 0) await this.storage.delete(doomed);

    return doomed.map(seqFromKey);
  }

  /** Number of retained messages. Never exceeds the cap after an append. */
  async count(): Promise<number> {
    const rows = await this.storage.list({ prefix: MESSAGE_KEY_PREFIX });
    return rows.size;
  }

  private async loadCursor(): Promise<Cursor> {
    if (this.cursor) return this.cursor;
    const raw = await this.storage.get(CURSOR_KEY);
    this.cursor = toCursor(raw) ?? { oldestSeq: 0, nextSeq: 0 };
    return this.cursor;
  }
}

/**
 * In-memory ChatStorage, used by the tests and by nothing else at runtime.
 * Exported from the module it mirrors so the two cannot drift apart.
 */
export function createMemoryChatStorage(): ChatStorage & {
  readonly entries: Map<string, unknown>;
} {
  const entries = new Map<string, unknown>();

  return {
    entries,
    get(key) {
      return Promise.resolve(entries.get(key));
    },
    put(next) {
      for (const [key, value] of Object.entries(next)) entries.set(key, value);
      return Promise.resolve();
    },
    delete(keys) {
      let removed = 0;
      for (const key of keys) if (entries.delete(key)) removed += 1;
      return Promise.resolve(removed);
    },
    list(options) {
      const matched = [...entries.entries()]
        .filter(([key]) => key.startsWith(options.prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      if (options.reverse) matched.reverse();
      const limited =
        options.limit === undefined ? matched : matched.slice(0, options.limit);
      return Promise.resolve(new Map(limited));
    },
  };
}
