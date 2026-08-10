/**
 * Join tickets for the anonymous chat room.
 *
 * A ticket is an HMAC over (version, expiry). It is verified in the Worker
 * before the Durable Object is touched, so an unverified probe costs a Worker
 * request rather than waking the room.
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

function payloadFor(expiresAt: number): string {
  return `${TICKET_VERSION}.${expiresAt}`;
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

/** Mints a ticket valid until `expiresAt` (epoch ms). */
export async function issueChatTicket(
  salt: string,
  expiresAt: number
): Promise<string> {
  const signature = await sign(payloadFor(expiresAt), salt);
  return `${TICKET_VERSION}.${expiresAt}.${signature}`;
}

/**
 * True only when the ticket is well-formed, unexpired and correctly signed.
 * Every failure path returns the same false — a caller learns nothing about
 * which check tripped.
 */
export async function verifyChatTicket(
  ticket: string,
  salt: string,
  now: number
): Promise<boolean> {
  const parts = ticket.split('.');
  if (parts.length !== 3) return false;

  const [version, expiresRaw, signature] = parts;
  if (version !== TICKET_VERSION) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = await sign(payloadFor(expiresAt), salt);
  return timingSafeEqual(signature, expected);
}
