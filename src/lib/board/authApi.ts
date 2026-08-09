/**
 * Auth API client — wraps the /api/auth/* and /api/me/* endpoints.
 *
 * Security contract:
 *   - Raw passwords never pass through here. Callers must derive authKey
 *     via src/lib/auth/deriveAuthKey.ts before calling signup/login/resetPassword.
 *   - Tokens are opaque strings managed by the server; this module only
 *     forwards them in Authorization headers.
 *   - All errors are surfaced as AuthApiError with a typed `kind` discriminant.
 */

import { BOARD_API_BASE } from "./api";
import type {
  AuthSession,
  AuthUser,
  SignupResult,
  MyPostsResponse,
  AuthErrorKind,
} from "../../types/board";
import { AuthApiError } from "../../types/board";

// ── Error mapping ──────────────────────────────────────────────────────────────

const AUTH_ERROR_KIND_MAP: Partial<Record<string, AuthErrorKind>> = {
  "nickname-taken": "nickname-taken",
  "invalid-nickname": "invalid-nickname",
  "captcha-failed": "captcha-failed",
  "invalid-credentials": "invalid-credentials",
  "invalid-recovery": "invalid-recovery",
  "rate-limited": "rate-limited",
  unauthorized: "unauthorized",
};

function toAuthError(
  status: number,
  body: { error?: string; message?: string } | null
): AuthApiError {
  const kind: AuthErrorKind =
    AUTH_ERROR_KIND_MAP[body?.error ?? ""] ??
    (status === 401 ? "unauthorized" : "network");
  return new AuthApiError(kind, body?.message ?? "오류가 발생했습니다.");
}

async function parseErrorBody(
  res: Response
): Promise<{ error?: string; message?: string } | null> {
  return res.json().catch(() => null) as Promise<{
    error?: string;
    message?: string;
  } | null>;
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────

export async function signupApi(
  nickname: string,
  authKey: string,
  turnstileToken: string,
  signal?: AbortSignal
): Promise<SignupResult> {
  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ nickname, authKey, turnstileToken }),
      signal,
    });
  } catch {
    throw new AuthApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 201) {
    return res.json() as Promise<SignupResult>;
  }
  throw toAuthError(res.status, await parseErrorBody(res));
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

export async function loginApi(
  nickname: string,
  authKey: string,
  signal?: AbortSignal
): Promise<AuthSession> {
  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ nickname, authKey }),
      signal,
    });
  } catch {
    throw new AuthApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 200) {
    return res.json() as Promise<AuthSession>;
  }
  throw toAuthError(res.status, await parseErrorBody(res));
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

export async function logoutApi(
  token: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    await fetch(`${BOARD_API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    // Best-effort — local session is cleared regardless of server response.
  } catch {
    // Ignore network errors on logout.
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

export async function getMeApi(
  token: string,
  signal?: AbortSignal
): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch {
    throw new AuthApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 200) {
    return res.json() as Promise<AuthUser>;
  }
  throw toAuthError(res.status, await parseErrorBody(res));
}

// ── POST /api/auth/reset-password ────────────────────────────────────────────

export async function resetPasswordApi(
  nickname: string,
  recoveryCode: string,
  authKey: string,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ nickname, recoveryCode, authKey }),
      signal,
    });
  } catch {
    throw new AuthApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 200) return;
  throw toAuthError(res.status, await parseErrorBody(res));
}

// ── GET /api/me/posts ─────────────────────────────────────────────────────────

export async function getMyPostsApi(
  token: string,
  opts: { cursor?: string; limit?: number; signal?: AbortSignal } = {}
): Promise<MyPostsResponse> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = `${BOARD_API_BASE}/api/me/posts${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: opts.signal,
    });
  } catch {
    throw new AuthApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 200) {
    return res.json() as Promise<MyPostsResponse>;
  }
  throw toAuthError(res.status, await parseErrorBody(res));
}
