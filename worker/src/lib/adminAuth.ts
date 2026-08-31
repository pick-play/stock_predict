import { constantTimeEqual } from './password';
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
 *
 * The comparison reuses password.ts's constantTimeEqual rather than `===`, so
 * a probe cannot time its way toward the token prefix by prefix. The token is
 * long and random, which makes that attack impractical anyway — but a secret
 * compare that leaks its first differing byte is a habit, not a decision.
 */
export function isAdmin(request: Request, env: Env): boolean {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get('Authorization') ?? '';
  return constantTimeEqual(provided, `Bearer ${expected}`);
}
