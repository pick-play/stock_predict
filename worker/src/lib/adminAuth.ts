import type { Env } from '../types';

/**
 * The single admin gate.
 *
 * Lives in its own module because the board routes and the chat room both need
 * it, and a second copy of a comparison against a secret is exactly the kind of
 * duplication that drifts.
 *
 * An unset ADMIN_TOKEN denies everything rather than matching "Bearer
 * undefined": a deployment that forgot the secret must be closed, not open.
 */
export function isAdmin(request: Request, env: Env): boolean {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return false;
  return request.headers.get('Authorization') === `Bearer ${expected}`;
}
