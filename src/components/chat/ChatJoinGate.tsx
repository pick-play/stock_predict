/**
 * The door to the room.
 *
 * No login is required to chat, so this challenge is the only thing standing
 * between the room and automated traffic. Clearing it once buys a join ticket
 * that also covers reconnects, so a flaky network does not mean a new CAPTCHA
 * every few minutes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { TurnstileWidget } from "../board/TurnstileWidget";
import { isTurnstileConfigured } from "../../lib/board/turnstileConfig";

interface ChatJoinGateProps {
  onJoin: (turnstileToken: string) => void;
  isJoining: boolean;
  error: string | null;
}

export function ChatJoinGate({ onJoin, isJoining, error }: ChatJoinGateProps) {
  const [token, setToken] = useState("");
  const [widgetError, setWidgetError] = useState<string | null>(null);
  /** Stops the unconfigured-Turnstile auto-join from firing twice. */
  const autoJoinedRef = useRef(false);

  const handleToken = useCallback((next: string) => {
    setToken(next);
    setWidgetError(null);
  }, []);

  const handleExpire = useCallback(() => setToken(""), []);

  const handleError = useCallback(() => {
    setToken("");
    setWidgetError("보안 문자를 불러올 수 없습니다. 새로고침 후 다시 시도해주세요.");
  }, []);

  // With no site key configured there is no challenge to clear, so the visitor
  // is let straight through and the Worker decides whether to accept the empty
  // token. That keeps local development usable without weakening production,
  // where the secret is always set and an empty token is refused.
  useEffect(() => {
    if (isTurnstileConfigured || autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    onJoin("");
  }, [onJoin]);

  const canJoin = (!isTurnstileConfigured || token.length > 0) && !isJoining;

  return (
    <div className="animate-slide-fade-in flex flex-col items-center justify-center px-6 py-16 text-center">
      <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
        실시간 채팅방 입장
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
        로그인 없이 바로 참여할 수 있습니다.
        <br />
        아래 확인만 거치면 입장됩니다.
      </p>

      {isTurnstileConfigured && (
        <div className="mt-5 flex justify-center">
          <TurnstileWidget
            onToken={handleToken}
            onExpire={handleExpire}
            onError={handleError}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => onJoin(token)}
        disabled={!canJoin}
        aria-label={isJoining ? "입장 중" : "채팅방 입장하기"}
        className="mt-5 min-h-[44px] px-6 rounded-lg text-sm font-semibold transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: canJoin
            ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
            : "rgba(139,124,255,0.15)",
          color: canJoin ? "#fff" : "var(--text-muted)",
        }}
      >
        {isJoining ? "입장 중…" : "입장하기"}
      </button>

      {(error ?? widgetError) && (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-4 max-w-sm rounded-lg border border-[rgba(255,93,108,0.18)] bg-[rgba(255,93,108,0.06)] px-3 py-2 text-sm leading-relaxed text-[#ff5d6c]"
        >
          {error ?? widgetError}
        </p>
      )}

      <p className="mt-6 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
        채팅은 익명으로 표시되며 투자 권유가 아닙니다. 최근 500개의 대화만
        보관되고 오래된 대화는 자동으로 사라집니다.
      </p>
    </div>
  );
}
