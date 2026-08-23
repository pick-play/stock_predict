/**
 * Presence is announced two ways and must not be announced twice.
 *
 * The dashboard's preview poll carries it as a flag on a request it was making
 * anyway; the board has no such poll, so a standalone ping covers it. Both read
 * this clock first. If it stopped working the failure would be invisible — the
 * count would still be right — while quietly costing the request the piggyback
 * exists to save, against a daily budget the site has already exhausted once.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  isPresenceDue,
  notePresenceSent,
  resetPresenceClock,
} from "../presenceClock";
import { CHAT_PRESENCE_PING_MS } from "../config";

describe("presence clock", () => {
  beforeEach(resetPresenceClock);

  it("is due on arrival, before anything has been sent", () => {
    expect(isPresenceDue(CHAT_PRESENCE_PING_MS)).toBe(true);
  });

  it("is not due again straight away", () => {
    notePresenceSent();
    expect(isPresenceDue(CHAT_PRESENCE_PING_MS)).toBe(false);
  });

  it("comes due once the interval has passed", () => {
    const t0 = 1_000_000;
    notePresenceSent(t0);

    expect(isPresenceDue(CHAT_PRESENCE_PING_MS, t0 + CHAT_PRESENCE_PING_MS - 1)).toBe(
      false
    );
    expect(isPresenceDue(CHAT_PRESENCE_PING_MS, t0 + CHAT_PRESENCE_PING_MS)).toBe(
      true
    );
  });

  /*
   * The flag rides a poll that runs more often than the interval, so most polls
   * must not carry it — otherwise the piggyback is just the old dedicated ping
   * wearing a different hat.
   */
  it("marks roughly one poll in three at the preview's cadence", async () => {
    const { CHAT_PREVIEW_REFRESH_MS } = await import("../config");
    let sent = 0;
    // A real timestamp: "never sent" is stored as 0, so a synthetic clock
    // starting there would read as "sent at the epoch" and skip the first poll.
    let now = 1_700_000_000_000;

    for (let poll = 0; poll < 12; poll++) {
      if (isPresenceDue(CHAT_PRESENCE_PING_MS, now)) {
        notePresenceSent(now);
        sent++;
      }
      now += CHAT_PREVIEW_REFRESH_MS;
    }

    // Twelve polls at 30s is six minutes; a 60s interval allows six.
    expect(sent).toBe(6);
  });

  /*
   * Whatever the two intervals are, a flag must arrive before the server
   * forgets this tab — otherwise visitors blink out of the count and back in.
   */
  it("announces well inside the server's expiry", async () => {
    const { CHAT_PRESENCE_TTL_MS, CHAT_PREVIEW_REFRESH_MS } = await import(
      "../config"
    );
    // Worst case: a flag is due just after a poll, so the next one carries it.
    const worstCase = CHAT_PRESENCE_PING_MS + CHAT_PREVIEW_REFRESH_MS;
    expect(worstCase).toBeLessThan(CHAT_PRESENCE_TTL_MS);
  });
});
