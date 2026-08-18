/**
 * The ticket is what makes a fixed nickname safe.
 *
 * A member's name is checked against the database once, when the ticket is
 * minted, and signed into it. The socket handshake then carries no credential
 * and the room reads the name from a header the Worker set — so the only way to
 * appear as someone else is to forge this signature.
 *
 * These tests exist to prove that is what the code actually does.
 */

import { describe, it, expect } from "vitest";
import { issueChatTicket, verifyChatTicket } from "../chatTicket";

const SALT = "test-salt-not-a-real-secret";
const NOW = 1_786_000_000_000;
const LATER = NOW + 30 * 60_000;

describe("chat ticket", () => {
  it("round-trips an anonymous ticket with no handle", async () => {
    const ticket = await issueChatTicket(SALT, LATER);
    const verified = await verifyChatTicket(ticket, SALT, NOW);

    expect(verified).not.toBeNull();
    expect(verified?.handle).toBeNull();
  });

  it("round-trips a member nickname", async () => {
    const ticket = await issueChatTicket(SALT, LATER, "국장의전설");
    const verified = await verifyChatTicket(ticket, SALT, NOW);

    expect(verified?.handle).toBe("국장의전설");
  });

  // The whole point: the name is not editable by whoever holds the ticket.
  it("refuses a ticket whose handle was swapped", async () => {
    const ticket = await issueChatTicket(SALT, LATER, "국장의전설");
    const [version, expires, , signature] = ticket.split(".");
    const forged = [version, expires, encodeURIComponent("관리자"), signature].join(".");

    expect(await verifyChatTicket(forged, SALT, NOW)).toBeNull();
  });

  it("refuses an anonymous ticket with a handle bolted on", async () => {
    const ticket = await issueChatTicket(SALT, LATER);
    const [version, expires, , signature] = ticket.split(".");
    const forged = [version, expires, encodeURIComponent("국장의전설"), signature].join(".");

    expect(await verifyChatTicket(forged, SALT, NOW)).toBeNull();
  });

  it("refuses a ticket signed with another salt", async () => {
    const ticket = await issueChatTicket("someone-elses-salt", LATER, "국장의전설");
    expect(await verifyChatTicket(ticket, SALT, NOW)).toBeNull();
  });

  it("refuses an expired ticket", async () => {
    const ticket = await issueChatTicket(SALT, NOW - 1, "국장의전설");
    expect(await verifyChatTicket(ticket, SALT, NOW)).toBeNull();
  });

  it("refuses the old three-part shape", async () => {
    const ticket = await issueChatTicket(SALT, LATER);
    const parts = ticket.split(".");
    expect(await verifyChatTicket(`${parts[0]}.${parts[1]}.${parts[3]}`, SALT, NOW)).toBeNull();
  });

  /*
   * The payload is length-prefixed. Without that, a nickname containing the
   * separator could be re-split into a different expiry carrying the same
   * signature — the classic forgery against a delimiter-joined MAC input.
   */
  it("cannot be re-parsed into a different expiry via a crafted handle", async () => {
    const crafted = `${LATER + 60_000}.x`;
    const ticket = await issueChatTicket(SALT, LATER, crafted);
    const verified = await verifyChatTicket(ticket, SALT, NOW);

    expect(verified?.handle).toBe(crafted);
  });

  it("survives a nickname with characters that need encoding", async () => {
    const ticket = await issueChatTicket(SALT, LATER, "한글 닉네임&test");
    expect((await verifyChatTicket(ticket, SALT, NOW))?.handle).toBe(
      "한글 닉네임&test"
    );
  });
});
