/**
 * The header's login / account control.
 *
 * Extracted from the board so the chat room can carry the same one. Chat needed
 * it once a logged-in member started appearing under their own nickname: the
 * room advertised "로그인 시 닉네임 고정" while offering no way to log in, so the
 * only route was to leave for the community, sign in, and come back.
 *
 * Renders nothing when the backend is unconfigured — a login button that cannot
 * reach a server is worse than none.
 */

import { isBoardConfigured } from "../../lib/board/api";
import { PILL_SURFACE } from "./controls";
import type { UseAuthReturn } from "../../hooks/useAuth";

interface AccountButtonProps {
  auth: UseAuthReturn;
  onOpen: () => void;
}

export function AccountButton({ auth, onOpen }: AccountButtonProps) {
  if (!isBoardConfigured) {
    return (
      <span className="text-[12px] text-[var(--text-muted)]">준비 중</span>
    );
  }

  const signedIn = auth.status === "authenticated";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={signedIn ? `내 계정: ${auth.nickname ?? ""}` : "로그인 또는 가입"}
      className={`${PILL_SURFACE} shrink-0`}
      style={{
        borderColor: signedIn ? "rgba(139,124,255,0.32)" : "var(--border-subtle)",
        color: signedIn ? "#8b7cff" : "var(--text-secondary)",
        background: signedIn ? "rgba(139,124,255,0.08)" : "var(--surface-2)",
      }}
    >
      {auth.status === "checking" ? (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-muted)]"
          aria-hidden="true"
        />
      ) : signedIn ? (
        <>
          <span aria-hidden="true">◆</span>
          <span className="max-w-[6rem] truncate">{auth.nickname}</span>
        </>
      ) : (
        "로그인"
      )}
    </button>
  );
}
