/**
 * password.ts
 *
 * Stores the credential the browser derived, never a password.
 *
 * The expensive stretching already happened on the device (see
 * src/lib/auth/deriveAuthKey.ts), because a Worker invocation cannot afford
 * 200k PBKDF2 rounds. What is left here must be cheap, so it is a keyed hash:
 * a per-user random salt makes every row unique, and a server-held pepper means
 * a stolen database alone is not enough to test candidate passwords offline —
 * the attacker also needs a secret that never appears in it.
 */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 16 random bytes, hex encoded. */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Keyed hash of the browser-derived auth key.
 * `pepper` is the PASSWORD_PEPPER secret and must never be logged or returned.
 */
export async function hashAuthKey(
  authKey: string,
  salt: string,
  pepper: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${salt}:${authKey}`)
  );

  return toHex(signature);
}

/**
 * Compare two hex digests without leaking where they first differ.
 * Length is compared first because unequal lengths cannot be a match anyway.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a login attempt. Always runs the hash even when the account is
 * missing, so a wrong nickname and a wrong password take the same time.
 */
export async function verifyAuthKey(
  authKey: string,
  salt: string,
  expectedHash: string,
  pepper: string
): Promise<boolean> {
  const actual = await hashAuthKey(authKey, salt, pepper);
  return constantTimeEqual(actual, expectedHash);
}
