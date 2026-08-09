/**
 * session.ts
 *
 * Shared helper for verifying bearer tokens and returning the authenticated
 * user. Used by every route that requires or optionally accepts a session.
 *
 * The session expiry is refreshed on each successful call so active users do
 * not have to re-log-in as long as they keep using the service.
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

  // Refresh expiry so active users stay logged in
  const newExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
    .bind(newExpiry, session.id)
    .run();

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
