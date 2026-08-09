/**
 * useAuth — manages the user session in localStorage and exposes auth actions.
 *
 * Token lifecycle:
 *   1. On mount, restore session from localStorage and verify via GET /api/auth/me.
 *      If the token is expired or invalid the server returns 401 → clear local state.
 *   2. login/signup store the token; logout clears it locally then calls the server.
 *   3. The raw password never appears in this hook. Callers pass a raw password;
 *      deriveAuthKey() stretches it before any network call is made.
 *
 * When BOARD_API_BASE is empty (board not configured) the hook stays in
 * "unauthenticated" status without making any network requests.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { deriveAuthKey } from "../lib/auth/deriveAuthKey";
import {
  loginApi,
  signupApi,
  logoutApi,
  getMeApi,
  resetPasswordApi,
} from "../lib/board/authApi";
import { AuthApiError } from "../types/board";
import type { SignupResult } from "../types/board";
import { isBoardConfigured } from "../lib/board/api";

// ── localStorage helpers ──────────────────────────────────────────────────────

const TOKEN_KEY = "board:auth:token";
const NICKNAME_KEY = "board:auth:nickname";

function readStoredSession(): { token: string; nickname: string } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const nickname = localStorage.getItem(NICKNAME_KEY);
    if (token && nickname) return { token, nickname };
  } catch {
    // Private mode or storage unavailable.
  }
  return null;
}

function writeSession(token: string, nickname: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // Private mode — session works for this page visit only.
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NICKNAME_KEY);
  } catch {
    // Ignore.
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | "idle"         // board not configured; no auth possible
  | "checking"     // verifying a stored token with the server
  | "authenticated"
  | "unauthenticated";

export interface UseAuthReturn {
  status: AuthStatus;
  nickname: string | null;
  token: string | null;
  /** Derives authKey from (nickname, password) then calls POST /api/auth/login. */
  login: (nickname: string, password: string) => Promise<void>;
  /** Derives authKey from (nickname, password) then calls POST /api/auth/signup.
   *  Returns the full SignupResult so the caller can display the recovery code. */
  signup: (
    nickname: string,
    password: string,
    turnstileToken: string
  ) => Promise<SignupResult>;
  logout: () => Promise<void>;
  /** Derives authKey from (nickname, newPassword) then calls POST /api/auth/reset-password. */
  resetPassword: (
    nickname: string,
    recoveryCode: string,
    newPassword: string
  ) => Promise<void>;
  error: string | null;
  clearError: () => void;
  isLoading: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const stored = readStoredSession();

  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!isBoardConfigured) return "idle";
    return stored ? "checking" : "unauthenticated";
  });
  const [nickname, setNickname] = useState<string | null>(
    stored?.nickname ?? null
  );
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const verifiedRef = useRef(false);

  // Verify the stored token on first mount.
  useEffect(() => {
    if (!isBoardConfigured || !stored || verifiedRef.current) return;
    verifiedRef.current = true;

    const ac = new AbortController();
    getMeApi(stored.token, ac.signal)
      .then((user) => {
        // Refresh cached nickname in case it was changed server-side.
        writeSession(stored.token, user.nickname);
        setNickname(user.nickname);
        setStatus("authenticated");
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        clearSession();
        setNickname(null);
        setToken(null);
        setStatus("unauthenticated");
      });

    return () => ac.abort();
    // Run once on mount — stored is a snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (rawNickname: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const authKey = await deriveAuthKey(rawNickname, password);
      const session = await loginApi(rawNickname, authKey);
      writeSession(session.token, session.nickname);
      setToken(session.token);
      setNickname(session.nickname);
      setStatus("authenticated");
    } catch (e) {
      const msg =
        e instanceof AuthApiError || e instanceof Error
          ? e.message
          : "로그인할 수 없습니다.";
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── signup ─────────────────────────────────────────────────────────────────

  const signup = useCallback(
    async (
      rawNickname: string,
      password: string,
      turnstileToken: string
    ): Promise<SignupResult> => {
      setError(null);
      setIsLoading(true);
      try {
        const authKey = await deriveAuthKey(rawNickname, password);
        const result = await signupApi(rawNickname, authKey, turnstileToken);
        writeSession(result.token, result.nickname);
        setToken(result.token);
        setNickname(result.nickname);
        setStatus("authenticated");
        return result;
      } catch (e) {
        const msg =
          e instanceof AuthApiError || e instanceof Error
            ? e.message
            : "가입할 수 없습니다.";
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ── logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const currentToken = token;
    // Clear local state immediately so the UI responds without waiting.
    clearSession();
    setToken(null);
    setNickname(null);
    setStatus("unauthenticated");
    if (currentToken) {
      // Best-effort server-side session invalidation.
      await logoutApi(currentToken).catch(() => {});
    }
  }, [token]);

  // ── resetPassword ──────────────────────────────────────────────────────────

  const resetPassword = useCallback(
    async (rawNickname: string, recoveryCode: string, newPassword: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const authKey = await deriveAuthKey(rawNickname, newPassword);
        await resetPasswordApi(rawNickname, recoveryCode, authKey);
      } catch (e) {
        const msg =
          e instanceof AuthApiError || e instanceof Error
            ? e.message
            : "비밀번호를 재설정할 수 없습니다.";
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    nickname,
    token,
    login,
    signup,
    logout,
    resetPassword,
    error,
    clearError,
    isLoading,
  };
}
