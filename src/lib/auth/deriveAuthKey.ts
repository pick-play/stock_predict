/**
 * deriveAuthKey.ts
 *
 * Stretches the password in the browser before it is ever sent.
 *
 * Why here and not on the server: a Worker invocation has a very small CPU
 * budget, far too small for the iteration count a password needs. Running the
 * slow part on the device keeps the work factor high without the server paying
 * it, and the raw password never leaves the browser — only this derived key,
 * which the Worker then peppers and hashes again before storing.
 *
 * The salt is the nickname rather than a random value because the client must
 * be able to derive the same key at every login without asking the server for
 * anything first. That makes the derivation deterministic per account, which is
 * exactly what a login needs, and the server-side pepper plus per-user salt is
 * what defends the stored value.
 *
 * Changing any constant here invalidates every existing password, so treat them
 * as frozen.
 */

const ITERATIONS = 210_000;
const KEY_BITS = 256;
const SALT_PREFIX = "kospinow|auth|v1|";

/** Nicknames are compared case-insensitively, so the salt must match that. */
export function normalizeNickname(nickname: string): string {
  return nickname.trim().normalize("NFKC").toLowerCase();
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive the value sent to the server in place of the password.
 * Takes roughly a second on a phone — call it behind a pending state.
 */
export async function deriveAuthKey(
  nickname: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT_PREFIX + normalizeNickname(nickname)),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BITS
  );

  return toHex(bits);
}
