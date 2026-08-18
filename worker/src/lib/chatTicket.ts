/**
 * Join tickets for the chat room.
 *
 * A ticket is an HMAC over (version, expiry, handle). It is verified in the
 * Worker before the Durable Object is touched, so an unverified probe costs a
 * Worker request rather than waking the room.
 *
 * The handle is empty for an anonymous joiner and carries the member's nickname
 * for a logged-in one. Binding it here is what makes a fixed nickname safe: the
 * session is checked once, against the database, when the ticket is minted, and
 * the signature means the client cannot edit the name it was given. A nickname
 * arriving in a socket frame would be a claim; this is a server statement.
 *
 * Note the difference from the IP binding that was removed below: an IP changes
 * under a phone that walks between cells, so binding it broke reconnects. A
 * nickname does not change while a ticket lives, and if the member logs out the
 * client simply asks for a new ticket.
 *
 * It used to be signed over the IP hash as well, to stop a ticket being shared.
 * That binding was removed, for two reasons.
 *
 * It had stopped protecting anything. The rationale was that a ticket cost a
 * CAPTCHA, so a shared one was worth having; with the CAPTCHA gone anyone can
 * mint their own with a bare POST, and the binding guards a door that is open.
 *
 * And it was actively breaking phones. The IP hash changes when the handset
 * changes network — cell handoff, Wi-Fi to cellular — and it changes for
 * everyone at UTC midnight, because hashIp rotates its salt by date. Either way
 * the ticket became unverifiable while still unexpired, so the client retried a
 * ticket the server would refuse forever and sat in "재연결 중…". Identity is
 * unaffected: the room reads it from the header the Worker sets per request,
 * never from the ticket.
 *
 * The signing key is derived from the existing IP_SALT secret with a domain
 * separator rather than from a new secret, so the owner has nothing extra to
 * register. The separator keeps ticket signatures and IP hashes in different
 * key spaces even though they share the same seed.
 */

const TICKET_VERSION = 'c1';
const KEY_DOMAIN = 'chat-ticket-v1';

async function ticketKey(salt: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${salt}|${KEY_DOMAIN}`);
  return crypto.subtle.importKey(
    'raw',
    material,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * Percent-encodes a handle so it can sit in a dot-joined ticket.
 *
 * encodeURIComponent leaves "." alone, and a dot inside the handle would split
 * the ticket into five parts and make it unverifiable — a member with a dot in
 * their nickname simply could not join. Nicknames cannot contain one today, but
 * a format that breaks on a character it never escaped is a trap for whoever
 * relaxes that rule later.
 */
function encodeHandle(handle: string): string {
  return encodeURIComponent(handle).replace(/\./g, "%2E");
}

async function sign(payload: string, salt: string): Promise<string> {
  const key = await ticketKey(salt);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The signed payload. The handle is length-prefixed so a nickname containing a
 * separator cannot be re-parsed into a different expiry, which is the classic
 * way a delimiter-joined MAC payload gets forged.
 */
function payloadFor(expiresAt: number, handle: string): string {
  return `${TICKET_VERSION}.${expiresAt}.${handle.length}.${handle}`;
}

/** Compares two hex digests without leaking where they first differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Mints a ticket valid until `expiresAt` (epoch ms).
 *
 * `handle` is the member nickname the Worker verified from the session, or ""
 * for an anonymous joiner. It travels in the clear — it is a public display
 * name, not a secret — and the signature is what stops it being changed.
 */
export async function issueChatTicket(
  salt: string,
  expiresAt: number,
  handle = ''
): Promise<string> {
  const signature = await sign(payloadFor(expiresAt, handle), salt);
  return `${TICKET_VERSION}.${expiresAt}.${encodeHandle(handle)}.${signature}`;
}

export interface VerifiedTicket {
  /** The member nickname the ticket was signed with, or null when anonymous. */
  handle: string | null;
}

/**
 * Returns the ticket's contents only when it is well-formed, unexpired and
 * correctly signed; null otherwise. Every failure path returns the same null —
 * a caller learns nothing about which check tripped.
 */
export async function verifyChatTicket(
  ticket: string,
  salt: string,
  now: number
): Promise<VerifiedTicket | null> {
  const parts = ticket.split('.');
  if (parts.length !== 4) return null;

  const [version, expiresRaw, handleRaw, signature] = parts;
  if (version !== TICKET_VERSION) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;

  let handle: string;
  try {
    handle = decodeURIComponent(handleRaw);
  } catch {
    return null;
  }

  const expected = await sign(payloadFor(expiresAt, handle), salt);
  if (!timingSafeEqual(signature, expected)) return null;

  return { handle: handle.length > 0 ? handle : null };
}
