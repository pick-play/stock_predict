/**
 * The one place a client address is read.
 *
 * CF-Connecting-IP is set by Cloudflare's edge (and by `wrangler dev`), and a
 * client cannot spoof it through the edge. X-Forwarded-For is deliberately NOT
 * consulted: it is client-controlled on any path that does not go through the
 * edge, and a forgeable address is worse than none — it would let one caller
 * rotate ip_hash at will and walk straight past the login rate limit.
 *
 * Every route must use this function rather than reading headers itself.
 * The routes used to carry six copy-pasted extractors plus two inline reads
 * that fell back to '' instead of '0.0.0.0', so the same visitor hashed to two
 * different ip_hash values depending on which endpoint counted them.
 */
export function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
}
