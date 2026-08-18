/**
 * AuthModal — compact modal for login, signup, password reset, and account view.
 *
 * Layout:
 *   Unauthenticated → tabs: 로그인 | 가입하기 | 비밀번호 재설정
 *   Authenticated   → account panel (nickname, post count, logout)
 *
 * Integrations:
 *   - Calls useAuth actions (login, signup, logout, resetPassword).
 *   - After signup, calls onRecoveryCode so the parent can show RecoveryCodeModal.
 *   - Signup form embeds TurnstileWidget for bot protection.
 *
 * Security:
 *   - Password inputs are type="password" with autocomplete hints.
 *   - Raw password values stay in component state only; deriveAuthKey is called
 *     inside useAuth before any network request.
 *   - No personal information fields (email, phone, name).
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { UseAuthReturn } from "../../../hooks/useAuth";
import type { AuthUser } from "../../../types/board";
import { AuthApiError } from "../../../types/board";
import type { SignupResult } from "../../../types/board";
import { TurnstileWidget } from "../TurnstileWidget";
import { isTurnstileConfigured } from "../../../lib/board/turnstileConfig";
import { getMeApi } from "../../../lib/board/authApi";
import { getMyPostsApi } from "../../../lib/board/authApi";
import type { MyPost } from "../../../types/board";
import { nicknameProblem } from "../../../lib/auth/nickname";

type AuthTab = "login" | "signup" | "reset";

// ── Shared field styles ───────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] px-3 py-2.5 transition-colors duration-150 focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[rgba(139,124,255,0.3)] disabled:opacity-50";

const labelClass = "block text-[12px] text-[var(--text-muted)] mb-1 tracking-widest uppercase";

// ── LoginForm ─────────────────────────────────────────────────────────────────

interface LoginFormProps {
  auth: UseAuthReturn;
  onSwitchTab: (tab: AuthTab) => void;
  onClose: () => void;
}

function LoginForm({ auth, onSwitchTab, onClose }: LoginFormProps) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current || auth.isLoading) return;
    submitLockRef.current = true;
    try {
      await auth.login(nickname.trim(), password);
      onClose();
    } catch {
      // auth.error is set by useAuth
    } finally {
      submitLockRef.current = false;
    }
  };

  const canSubmit =
    nickname.trim().length >= 2 && password.length >= 1 && !auth.isLoading;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-3">
      <div>
        <label htmlFor="auth-login-nickname" className={labelClass}>닉네임</label>
        <input
          id="auth-login-nickname"
          type="text"
          value={nickname}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNickname(e.target.value);
            auth.clearError();
          }}
          autoComplete="username"
          maxLength={16}
          placeholder="닉네임"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="auth-login-password" className={labelClass}>비밀번호</label>
        <input
          id="auth-login-password"
          type="password"
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setPassword(e.target.value);
            auth.clearError();
          }}
          autoComplete="current-password"
          placeholder="비밀번호"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>

      {auth.error && (
        <p role="alert" className="text-xs text-[#ff5d6c] leading-relaxed">
          {auth.error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canSubmit
            ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
            : "rgba(139,124,255,0.15)",
          color: canSubmit ? "#fff" : "var(--text-muted)",
        }}
      >
        {auth.isLoading ? "로그인 중…" : "로그인"}
      </button>

      <p className="text-[12px] text-[var(--text-muted)] text-center leading-relaxed pt-1">
        비밀번호를 잊으셨나요?{" "}
        <button
          type="button"
          onClick={() => onSwitchTab("reset")}
          className="text-[#8b7cff] hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:underline"
        >
          복구 코드로 재설정
        </button>
      </p>
    </form>
  );
}

// ── SignupForm ────────────────────────────────────────────────────────────────

interface SignupFormProps {
  auth: UseAuthReturn;
  onSuccess: (result: SignupResult) => void;
}

function SignupForm({ auth, onSuccess }: SignupFormProps) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const handleTurnstileToken = useCallback((t: string) => {
    setTurnstileToken(t);
    setTurnstileError(false);
  }, []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(null), []);
  const handleTurnstileError = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileError(true);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current || auth.isLoading) return;

    setLocalError(null);
    auth.clearError();

    /*
     * Same rule the Worker applies, checked here so someone who typed a space
     * is told that in the form rather than by a rejected request. The server
     * remains the authority — this only saves the round trip.
     */
    const nicknameIssue = nicknameProblem(nickname.trim());
    if (nicknameIssue) {
      setLocalError(nicknameIssue);
      return;
    }

    if (password !== passwordConfirm) {
      setLocalError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      setLocalError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (isTurnstileConfigured && !turnstileToken) {
      setLocalError("보안 문자를 완료해주세요.");
      return;
    }

    submitLockRef.current = true;
    try {
      const result = await auth.signup(
        nickname.trim(),
        password,
        turnstileToken ?? ""
      );
      onSuccess(result);
    } catch {
      // auth.error is set by useAuth
    } finally {
      submitLockRef.current = false;
    }
  };

  const displayError = localError ?? auth.error;
  const canSubmit =
    nicknameProblem(nickname.trim()) === null &&
    password.length >= 8 &&
    passwordConfirm.length >= 1 &&
    (!isTurnstileConfigured || turnstileToken !== null) &&
    !auth.isLoading;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-3">
      <div>
        <label htmlFor="auth-signup-nickname" className={labelClass}>닉네임</label>
        <input
          id="auth-signup-nickname"
          type="text"
          value={nickname}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNickname(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="username"
          maxLength={16}
          placeholder="2~16자, 한글·영문·숫자·밑줄 (띄어쓰기 불가)"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="auth-signup-password" className={labelClass}>비밀번호</label>
        <input
          id="auth-signup-password"
          type="password"
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setPassword(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="new-password"
          placeholder="8자 이상"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="auth-signup-password-confirm" className={labelClass}>비밀번호 확인</label>
        <input
          id="auth-signup-password-confirm"
          type="password"
          value={passwordConfirm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setPasswordConfirm(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="new-password"
          placeholder="비밀번호 다시 입력"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>

      <TurnstileWidget
        onToken={handleTurnstileToken}
        onExpire={handleTurnstileExpire}
        onError={handleTurnstileError}
      />
      {turnstileError && (
        <p className="text-xs text-[#ff5d6c]" role="alert">
          보안 문자를 불러올 수 없습니다. 페이지를 새로고침해주세요.
        </p>
      )}

      {displayError && (
        <p role="alert" className="text-xs text-[#ff5d6c] leading-relaxed">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canSubmit
            ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
            : "rgba(139,124,255,0.15)",
          color: canSubmit ? "#fff" : "var(--text-muted)",
        }}
      >
        {auth.isLoading ? "가입 중…" : "가입하기"}
      </button>

      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
        수집 정보: 닉네임과 비밀번호뿐입니다. 이메일·전화번호를 묻지 않습니다.
        비밀번호를 잊으면 가입 시 발급된 복구 코드로만 재설정할 수 있습니다.
      </p>
    </form>
  );
}

// ── ResetPasswordForm ─────────────────────────────────────────────────────────

interface ResetPasswordFormProps {
  auth: UseAuthReturn;
  onSuccess: () => void;
}

function ResetPasswordForm({ auth, onSuccess }: ResetPasswordFormProps) {
  const [nickname, setNickname] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current || auth.isLoading) return;

    setLocalError(null);
    auth.clearError();

    if (newPassword !== newPasswordConfirm) {
      setLocalError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword.length < 8) {
      setLocalError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    submitLockRef.current = true;
    try {
      await auth.resetPassword(
        nickname.trim(),
        recoveryCode.trim(),
        newPassword
      );
      setDone(true);
      window.setTimeout(onSuccess, 1500);
    } catch {
      // auth.error is set by useAuth
    } finally {
      submitLockRef.current = false;
    }
  };

  if (done) {
    return (
      <p role="status" className="text-sm text-[#31c48d] text-center py-4">
        비밀번호가 재설정되었습니다. 다시 로그인해 주세요.
      </p>
    );
  }

  const displayError = localError ?? auth.error;
  const canSubmit =
    nickname.trim().length >= 2 &&
    recoveryCode.trim().length > 0 &&
    newPassword.length >= 8 &&
    newPasswordConfirm.length >= 1 &&
    !auth.isLoading;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
        가입 시 발급된 복구 코드를 입력하면 비밀번호를 재설정할 수 있습니다.
        기존 세션은 모두 폐기됩니다.
      </p>
      <div>
        <label htmlFor="auth-reset-nickname" className={labelClass}>닉네임</label>
        <input
          id="auth-reset-nickname"
          type="text"
          value={nickname}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNickname(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="username"
          maxLength={16}
          placeholder="닉네임"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="auth-reset-code" className={labelClass}>복구 코드</label>
        <input
          id="auth-reset-code"
          type="text"
          value={recoveryCode}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setRecoveryCode(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="one-time-code"
          placeholder="가입 시 저장한 복구 코드"
          disabled={auth.isLoading}
          className={`${fieldClass} font-mono tracking-widest`}
        />
      </div>
      <div>
        <label htmlFor="auth-reset-password" className={labelClass}>새 비밀번호</label>
        <input
          id="auth-reset-password"
          type="password"
          value={newPassword}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNewPassword(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="new-password"
          placeholder="8자 이상"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="auth-reset-password-confirm" className={labelClass}>새 비밀번호 확인</label>
        <input
          id="auth-reset-password-confirm"
          type="password"
          value={newPasswordConfirm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNewPasswordConfirm(e.target.value);
            setLocalError(null);
            auth.clearError();
          }}
          autoComplete="new-password"
          placeholder="새 비밀번호 다시 입력"
          disabled={auth.isLoading}
          className={fieldClass}
        />
      </div>

      {displayError && (
        <p role="alert" className="text-xs text-[#ff5d6c] leading-relaxed">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canSubmit
            ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
            : "rgba(139,124,255,0.15)",
          color: canSubmit ? "#fff" : "var(--text-muted)",
        }}
      >
        {auth.isLoading ? "재설정 중…" : "비밀번호 재설정"}
      </button>
    </form>
  );
}

/** One number in the account summary. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-3)] px-2 py-1.5 text-center">
      <dt className="text-[11px] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
        {value}
      </dd>
    </div>
  );
}

// ── AccountPanel ──────────────────────────────────────────────────────────────

interface AccountPanelProps {
  auth: UseAuthReturn;
  onClose: () => void;
}

function AccountPanel({ auth, onClose }: AccountPanelProps) {
  const [userInfo, setUserInfo] = useState<AuthUser | null>(null);
  const [myPosts, setMyPosts] = useState<MyPost[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [showMyPosts, setShowMyPosts] = useState(false);

  // Load user info on mount
  useEffect(() => {
    if (!auth.token) return;
    const ac = new AbortController();
    getMeApi(auth.token, ac.signal)
      .then((u) => setUserInfo(u))
      .catch(() => {});
    return () => ac.abort();
  }, [auth.token]);

  const handleShowMyPosts = async () => {
    if (!auth.token || loadingPosts) return;
    setShowMyPosts(true);
    if (myPosts !== null) return; // already loaded
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const data = await getMyPostsApi(auth.token, { limit: 20 });
      setMyPosts(data.posts);
    } catch (e) {
      setPostsError(
        e instanceof AuthApiError || e instanceof Error
          ? e.message
          : "글 목록을 불러올 수 없습니다."
      );
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    onClose();
  };

  function formatTime(iso: string): string {
    try {
      return new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return "—";
    }
  }

  return (
    <div className="space-y-4">
      {/* Account summary */}
      <div
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3"
      >
        <p className="text-xs text-[var(--text-muted)] mb-0.5">로그인됨</p>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {auth.nickname}
        </p>
        {userInfo && (
          <>
            {/*
              Attendance first: it is the one number that moves without the
              member doing anything, so it is the one they came to look at.
              The streak is shown only while it is running — "연속 1일" on the
              day someone returns after a gap reads as a rebuke.
            */}
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="출석" value={`${userInfo.visitDays}일`} />
              <Stat label="작성 글" value={`${userInfo.postCount}개`} />
              <Stat label="댓글" value={`${userInfo.commentCount}개`} />
            </dl>
            {userInfo.visitStreak > 1 && (
              <p className="mt-2 text-[12px] text-[#8b7cff]">
                연속 {userInfo.visitStreak}일 출석 중
              </p>
            )}
          </>
        )}
      </div>

      {/* My posts toggle */}
      {!showMyPosts ? (
        <button
          type="button"
          onClick={() => void handleShowMyPosts()}
          className="w-full py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
        >
          내 글 보기
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-[var(--text-muted)] tracking-widest uppercase">
            내 글
          </p>
          {loadingPosts && (
            <p className="text-xs text-[var(--text-muted)] text-center py-3">
              불러오는 중…
            </p>
          )}
          {postsError && (
            <p role="alert" className="text-xs text-[#ff5d6c]">
              {postsError}
            </p>
          )}
          {myPosts !== null && myPosts.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center py-3">
              작성한 글이 없습니다.
            </p>
          )}
          {myPosts !== null && myPosts.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {myPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                >
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed line-clamp-2 whitespace-pre-wrap break-words">
                    {post.body}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <time className="text-[12px] text-[var(--text-muted)] tabular-nums">
                      {formatTime(post.createdAt)}
                    </time>
                    {post.hiddenAt && (
                      <span className="text-[12px] text-[#f5b942]">숨김</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logout */}
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="w-full py-2 rounded-lg text-xs font-medium text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:border-[rgba(255,93,108,0.3)] hover:text-[#ff5d6c] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5d6c]"
      >
        로그아웃
      </button>
    </div>
  );
}

// ── AuthModal (main export) ───────────────────────────────────────────────────

interface AuthModalProps {
  auth: UseAuthReturn;
  onClose: () => void;
  onRecoveryCode: (result: SignupResult) => void;
}

export function AuthModal({ auth, onClose, onRecoveryCode }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>("login");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSignupSuccess = (result: SignupResult) => {
    onRecoveryCode(result);
  };

  const handleResetSuccess = () => {
    setTab("login");
    auth.clearError();
  };

  const isAuthenticated = auth.status === "authenticated";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-end p-3 pt-14"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAuthenticated ? "계정 정보" : "로그인 / 가입"}
        className="w-full max-w-xs rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl animate-slide-fade-in"
        style={{ boxShadow: "0 16px 64px rgba(0,0,0,0.5)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {isAuthenticated ? "내 계정" : "계정"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4">
          {isAuthenticated ? (
            <AccountPanel auth={auth} onClose={onClose} />
          ) : (
            <>
              {/* Tabs — only for unauthenticated views */}
              <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                {(["login", "signup", "reset"] as AuthTab[]).map((t) => {
                  const labels: Record<AuthTab, string> = {
                    login: "로그인",
                    signup: "가입",
                    reset: "복구",
                  };
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTab(t);
                        auth.clearError();
                      }}
                      className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#8b7cff]"
                      style={{
                        background:
                          tab === t ? "var(--surface-1)" : "transparent",
                        color:
                          tab === t
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        boxShadow:
                          tab === t
                            ? "0 1px 3px rgba(0,0,0,0.2)"
                            : "none",
                      }}
                      aria-pressed={tab === t}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>

              {tab === "login" && (
                <LoginForm
                  auth={auth}
                  onSwitchTab={setTab}
                  onClose={onClose}
                />
              )}
              {tab === "signup" && (
                <SignupForm auth={auth} onSuccess={handleSignupSuccess} />
              )}
              {tab === "reset" && (
                <ResetPasswordForm
                  auth={auth}
                  onSuccess={handleResetSuccess}
                />
              )}

              <p className="text-[12px] text-[var(--text-muted)] text-center mt-4 leading-relaxed">
                로그인 없이도 익명으로 글을 쓸 수 있습니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
