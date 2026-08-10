/**
 * Join tickets for the anonymous chat room.
 *
 * A ticket is an HMAC over (version, expiry, IP hash) that the Worker hands out
 * only after Turnstile passes. It exists because Turnstile tokens are
 * single-use: without a ticket every dropped socket would demand a fresh
 * CAPTCHA, which punishes exactly the people on flaky mobile networks. Binding
 * the signature to the IP hash means a ticket cannot be shared with a botnet —
 * the hash it was minted for has to match the hash presented at reconnect.
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

function payloadFor(expiresAt: number, ipHash: string): string {
  return `${TICKET_VERSION}.${expiresAt}.${ipHash}`;
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
  ipHash: string,
  salt: string,
  expiresAt: number
): Promise<string> {
  const signature = await sign(payloadFor(expiresAt, ipHash), salt);
  return `${TICKET_VERSION}.${expiresAt}.${signature}`;
}

/**
 * True only when the ticket is well-formed, unexpired, and was minted for this
 * IP hash. Every failure path returns the same false — a caller learns nothing
 * about which check tripped.
 */
export async function verifyChatTicket(
  ticket: string,
  ipHash: string,
  salt: string,
  now: number
): Promise<boolean> {
  const parts = ticket.split('.');
  if (parts.length !== 3) return false;

  const [version, expiresRaw, signature] = parts;
  if (version !== TICKET_VERSION) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = await sign(payloadFor(expiresAt, ipHash), salt);
  return timingSafeEqual(signature, expected);
}
