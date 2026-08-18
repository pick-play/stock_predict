/**
 * auth.ts — account management endpoints
 *
 * Security invariants kept here:
 *  - authKey (PBKDF2 output) and recoveryCode are never logged.
 *  - Login and reset-password always run the full hash even when the account
 *    does not exist, so wrong-nickname and wrong-password take the same time.
 *  - Recovery codes are returned once on signup and stored as SHA-256 hashes only.
 *  - All D1 access uses prepared-statement binding.
 *  - PASSWORD_PEPPER absence causes an explicit 500; it is never bypassed.
 */

import { moderatePost } from '../../../src/lib/moderation/filter';
import { nicknameProblem } from '../../../src/lib/auth/nickname';
import { hashIp } from '../lib/ipHash';
import { isSignupRateLimited, isLoginRateLimited } from '../lib/rateLimit';
import {
  hashAuthKey,
  generateSalt,
  verifyAuthKey,
  constantTimeEqual,
} from '../lib/password';
import {
  generateSessionToken,
  hashSessionToken,
  readBearerToken,
  SESSION_TTL_MS,
} from '../lib/sessionToken';
import { verifyTurnstile } from '../lib/turnstile';
import { requireAuth } from '../lib/session';
import { recordVisit } from '../lib/attendance';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env, UserRow } from '../types';

const encoder = new TextEncoder();

/** Placeholder values used when the account is not found to preserve timing parity. */
const DUMMY_SALT = '0'.repeat(32);
const DUMMY_HASH = '0'.repeat(64);


const RESERVED_NICKNAMES = new Set([
  '관리자',
  '운영자',
  'admin',
  'administrator',
  '운영진',
  '공지',
  '익명',
]);

function normalizeNickname(nickname: string): string {
  return nickname.trim().normalize('NFKC').toLowerCase();
}

/** Returns a Korean error message, or null if the nickname is valid. */
function validateNickname(nickname: string): string | null {
  // Shared with the signup form so both say the same thing; see the module.
  const shapeProblem = nicknameProblem(nickname);
  if (shapeProblem) return shapeProblem;
  if (RESERVED_NICKNAMES.has(normalizeNickname(nickname))) {
    return '사용할 수 없는 닉네임입니다.';
  }
  const modResult = moderatePost(nickname);
  if (!modResult.ok) {
    return modResult.message ?? '사용할 수 없는 닉네임입니다.';
  }
  return null;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    '0.0.0.0'
  );
}

/**
 * Generates a 16-byte recovery code formatted as
 * xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx (32 hex chars in 8 groups of 4).
 * Returned to the user once on signup; never stored in plain form.
 */
function generateRecoveryCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return (hex.match(/.{4}/g) as string[]).join('-');
}

/**
 * SHA-256 of the normalized (dashes stripped, lowercased) recovery code.
 * Used for both storage and verification.
 */
async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = code.replace(/-/g, '').toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── POST /api/auth/signup ─────────────────────────────────────────────────

interface SignupBody {
  nickname?: unknown;
  authKey?: unknown;
  turnstileToken?: unknown;
}

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  if (!env.PASSWORD_PEPPER) {
    return errorResponse('server-error', '서버 설정 오류입니다.', 500, request, env);
  }

  let parsed: SignupBody;
  try {
    parsed = (await request.json()) as SignupBody;
  } catch {
    return errorResponse('invalid-body', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  const { nickname, authKey, turnstileToken } = parsed;

  if (
    typeof nickname !== 'string' ||
    typeof authKey !== 'string' ||
    typeof turnstileToken !== 'string'
  ) {
    return errorResponse('invalid-body', '필수 항목이 누락되었습니다.', 400, request, env);
  }

  // authKey must be exactly 64 lowercase hex chars (256-bit PBKDF2 output)
  if (!/^[a-f0-9]{64}$/.test(authKey)) {
    return errorResponse('invalid-body', '잘못된 인증 키 형식입니다.', 400, request, env);
  }

  const nicknameError = validateNickname(nickname);
  if (nicknameError) {
    return errorResponse('invalid-nickname', nicknameError, 422, request, env);
  }

  const ip = getClientIp(request);
  const captchaOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!captchaOk) {
    return errorResponse(
      'captcha-failed',
      'CAPTCHA 검증에 실패했습니다. 다시 시도해주세요.',
      403,
      request,
      env
    );
  }

  const ipHash = await hashIp(ip, env.IP_SALT);

  if (await isSignupRateLimited(env.DB, ipHash)) {
    return errorResponse('rate-limited', '잠시 후 다시 시도해주세요.', 429, request, env);
  }

  const nicknameNormalized = normalizeNickname(nickname);

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE nickname_normalized = ?'
  )
    .bind(nicknameNormalized)
    .first<{ id: number }>();

  if (existing) {
    return errorResponse('nickname-taken', '이미 사용 중인 닉네임입니다.', 409, request, env);
  }

  const now = new Date().toISOString();
  const salt = generateSalt();
  const passwordHash = await hashAuthKey(authKey, salt, env.PASSWORD_PEPPER);

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);

  const { meta } = await env.DB.prepare(
    `INSERT INTO users
       (nickname, nickname_normalized, password_salt, password_hash,
        recovery_code_hash, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(nickname, nicknameNormalized, salt, passwordHash, recoveryCodeHash, ipHash, now)
    .run();

  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(meta.last_row_id, tokenHash, now, expiresAt)
    .run();

  // recoveryCode is returned here and never again — server stores only the hash
  return jsonResponse({ token, nickname, recoveryCode }, 201, request, env);
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────

interface LoginBody {
  nickname?: unknown;
  authKey?: unknown;
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.PASSWORD_PEPPER) {
    return errorResponse('server-error', '서버 설정 오류입니다.', 500, request, env);
  }

  let parsed: LoginBody;
  try {
    parsed = (await request.json()) as LoginBody;
  } catch {
    return errorResponse('invalid-body', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  const { nickname, authKey } = parsed;

  if (typeof nickname !== 'string' || typeof authKey !== 'string') {
    return errorResponse('invalid-body', '필수 항목이 누락되었습니다.', 400, request, env);
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT);
  const now = new Date().toISOString();

  // Log this attempt before the rate-limit check so it counts toward the window
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip_hash, created_at) VALUES (?, ?)'
  )
    .bind(ipHash, now)
    .run();

  if (await isLoginRateLimited(env.DB, ipHash)) {
    return errorResponse('rate-limited', '잠시 후 다시 시도해주세요.', 429, request, env);
  }

  const nicknameNormalized = normalizeNickname(nickname);

  const user = await env.DB.prepare(
    `SELECT id, nickname, password_salt, password_hash, created_at
     FROM users WHERE nickname_normalized = ?`
  )
    .bind(nicknameNormalized)
    .first<UserRow>();

  // Always run the hash regardless of whether the account exists — timing parity
  const salt = user?.password_salt ?? DUMMY_SALT;
  const expectedHash = user?.password_hash ?? DUMMY_HASH;
  const valid = await verifyAuthKey(authKey, salt, expectedHash, env.PASSWORD_PEPPER);

  if (!user || !valid) {
    // Same response whether the nickname is unknown or the password is wrong
    return errorResponse(
      'invalid-credentials',
      '닉네임 또는 비밀번호가 올바르지 않습니다.',
      401,
      request,
      env
    );
  }

  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(user.id, tokenHash, now, expiresAt)
    .run();

  return jsonResponse({ token, nickname: user.nickname }, 200, request, env);
}

// ─── POST /api/auth/logout ─────────────────────────────────────────────────

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }

  const tokenHash = await hashSessionToken(token);
  const now = new Date().toISOString();

  const session = await env.DB.prepare(
    'SELECT id FROM sessions WHERE token_hash = ? AND expires_at > ?'
  )
    .bind(tokenHash, now)
    .first<{ id: number }>();

  if (!session) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }

  // Delete only this session; other devices remain logged in
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
    .bind(session.id)
    .run();

  return jsonResponse({ ok: true }, 200, request, env);
}

// ─── GET /api/auth/me ──────────────────────────────────────────────────────

export async function handleGetMe(request: Request, env: Env): Promise<Response> {
  const user = await requireAuth(request, env);
  if (!user) {
    return errorResponse(
      'unauthorized',
      '인증이 필요하거나 세션이 만료되었습니다.',
      401,
      request,
      env
    );
  }

  /*
   * The account panel's three numbers, gathered here because this is the one
   * call the client already makes when a page mounts. Two counts and, at most
   * once a day, one write for attendance.
   */
  const [postCountRow, commentCountRow, attendance] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM posts WHERE member_id = ?')
      .bind(user.id)
      .first<{ cnt: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM comments WHERE member_id = ?')
      .bind(user.id)
      .first<{ cnt: number }>(),
    recordVisit(env.DB, user.id),
  ]);

  return jsonResponse(
    {
      nickname: user.nickname,
      createdAt: user.createdAt,
      postCount: postCountRow?.cnt ?? 0,
      commentCount: commentCountRow?.cnt ?? 0,
      visitDays: attendance.visitDays,
      visitStreak: attendance.visitStreak,
    },
    200,
    request,
    env
  );
}

// ─── POST /api/auth/reset-password ────────────────────────────────────────

interface ResetPasswordBody {
  nickname?: unknown;
  recoveryCode?: unknown;
  authKey?: unknown;
}

export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  if (!env.PASSWORD_PEPPER) {
    return errorResponse('server-error', '서버 설정 오류입니다.', 500, request, env);
  }

  let parsed: ResetPasswordBody;
  try {
    parsed = (await request.json()) as ResetPasswordBody;
  } catch {
    return errorResponse('invalid-body', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  const { nickname, recoveryCode, authKey } = parsed;

  if (
    typeof nickname !== 'string' ||
    typeof recoveryCode !== 'string' ||
    typeof authKey !== 'string'
  ) {
    return errorResponse('invalid-body', '필수 항목이 누락되었습니다.', 400, request, env);
  }

  if (!/^[a-f0-9]{64}$/.test(authKey)) {
    return errorResponse('invalid-body', '잘못된 인증 키 형식입니다.', 400, request, env);
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT);
  const now = new Date().toISOString();

  // Reuse login_attempts to rate-limit brute-force of recovery codes
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip_hash, created_at) VALUES (?, ?)'
  )
    .bind(ipHash, now)
    .run();

  if (await isLoginRateLimited(env.DB, ipHash)) {
    return errorResponse('rate-limited', '잠시 후 다시 시도해주세요.', 429, request, env);
  }

  const nicknameNormalized = normalizeNickname(nickname);

  const user = await env.DB.prepare(
    'SELECT id, recovery_code_hash FROM users WHERE nickname_normalized = ?'
  )
    .bind(nicknameNormalized)
    .first<UserRow>();

  // Always hash the submitted code — same time whether the account exists or not
  const storedHash = user?.recovery_code_hash ?? DUMMY_HASH;
  const codeHash = await hashRecoveryCode(recoveryCode);
  const valid = constantTimeEqual(codeHash, storedHash);

  if (!user || !valid) {
    // Same response whether nickname is unknown or the code is wrong
    return errorResponse(
      'invalid-recovery',
      '닉네임 또는 복구 코드가 올바르지 않습니다.',
      401,
      request,
      env
    );
  }

  const newSalt = generateSalt();
  const newPasswordHash = await hashAuthKey(authKey, newSalt, env.PASSWORD_PEPPER);

  await env.DB.prepare(
    'UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?'
  )
    .bind(newSalt, newPasswordHash, user.id)
    .run();

  // Revoke all existing sessions so old credentials cannot be reused
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
    .bind(user.id)
    .run();

  return jsonResponse({ ok: true }, 200, request, env);
}
