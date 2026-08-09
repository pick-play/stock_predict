/**
 * sessionToken.ts
 *
 * Opaque bearer tokens for logged-in sessions.
 *
 * The board is served from a different origin than the Worker, so a cookie
 * would need SameSite=None and would ride along on every cross-site request.
 * A bearer token the page attaches deliberately carries no ambient authority,
 * which removes CSRF from the picture entirely.
 *
 * Only the SHA-256 of a token is stored. A leaked database therefore cannot be
 * replayed as a login, the same reason password hashes are not stored raw.
 */

const encoder = new TextEncoder();

/** Sessions expire after 30 days of wall-clock time, refreshed on use. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 32 random bytes, hex encoded — the value the browser keeps. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lookup key for a token. Never store or log the token itself. */
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Extract the token from an Authorization header, or null when absent. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+([A-Fa-f0-9]{64})$/.exec(header.trim());
  return match ? match[1].toLowerCase() : null;
}
