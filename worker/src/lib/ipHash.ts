/**
 * HMAC-SHA256 IP hashing with daily salt rotation.
 * The date component (YYYY-MM-DD UTC) causes the same IP to produce a
 * different hash each day, fulfilling the "daily rotation" requirement
 * from board-api.md without ever storing the raw IP.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const keyMaterial = new TextEncoder().encode(salt + dateStr);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Derive display tag from the first 4 hex chars of the IP hash. */
export function toAuthorTag(ipHash: string): string {
  return `익명#${ipHash.slice(0, 4)}`;
}
