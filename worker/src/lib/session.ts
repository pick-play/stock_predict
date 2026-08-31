/**
 * session.ts
 *
 * Shared helper for verifying bearer tokens and returning the authenticated
 * user. Used by every route that requires or optionally accepts a session.
 *
 * The session expiry slides forward while the user stays active, but the row
 * is only rewritten once less than half the TTL remains — see the comment in
 * requireAuth for why a write per request was unaffordable.
 */

import { readBearerToken, hashSessionToken, SESSION_TTL_MS } from './sessionToken';
import type { Env, SessionRow, UserRow } from '../types';

export interface AuthUser {
  id: number;
  nickname: string;
  createdAt: string;
}

/**
 * Verifies the bearer token in the request.
 * Returns the authenticated user on success, null when the token is absent,
 * expired, or unknown.
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<AuthUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const tokenHash = await hashSessionToken(token);
  const now = new Date().toISOString();

  const session = await env.DB.prepare(
    'SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?'
  )
    .bind(tokenHash, now)
    .first<SessionRow>();

  if (!session) return null;

  /*
   * Sliding renewal, but only once the session has burned through half its
   * lifetime. Refreshing on EVERY authenticated request was one row written
   * per request, and rows written is the first resource this project runs out
   * of on the free plan (§28.3/§28.7) — an active member browsing the board
   * was paying a write per page for a timestamp 30 days in the future that
   * moved by seconds. With a 30-day TTL the renewal now costs at most one
   * write per session per ~15 days, and the user-visible behaviour is
   * unchanged: anyone active inside a 15-day window never expires.
   */
  const remainingMs = new Date(session.expires_at).getTime() - Date.now();
  if (remainingMs < SESSION_TTL_MS / 2) {
    const newExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(newExpiry, session.id)
      .run();
  }

  const user = await env.DB.prepare(
    'SELECT id, nickname, created_at FROM users WHERE id = ?'
  )
    .bind(session.user_id)
    .first<UserRow>();

  if (!user) return null;

  return {
    id: user.id,
    nickname: user.nickname,
    createdAt: user.created_at,
  };
}
