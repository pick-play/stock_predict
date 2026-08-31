/**
 * Moderator console at #admin.
 *
 * The typed password is checked by the server (POST /api/admin/login), which
 * answers with the bearer token every later action carries. A page that decided
 * for itself whether a password was right would be decoration — anyone can edit
 * what a browser believes.
 *
 * Two secrets on purpose: the password is short so it can be remembered, and it
 * is only accepted by that one attempt-limited endpoint; the token is long and
 * random and is the only thing the delete APIs accept.
 *
 * Nothing links here. That is not the boundary — the password is — it just keeps
 * the door out of readers' way.
 */

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Trash2, EyeOff, Eye, RefreshCw, LogOut } from "lucide-react";
import {
  AdminApiError,
  adminLogin,
  deleteChatLines,
  deleteComment,
  deletePost,
  fetchAdminComments,
  fetchAdminPosts,
  fetchChatLines,
  hidePost,
  isAdminConfigured,
  unhidePost,
  type AdminComment,
  type AdminPost,
  type PostFilter,
} from "../lib/admin/api";
import {
  clearAdminToken,
  readAdminToken,
  writeAdminToken,
} from "../lib/admin/session";
import { formatKoreanTime } from "../lib/format";
import { BRAND_NAME } from "../config/brand";
import type { ChatMessage } from "../types/chat";

/** How many chat lines the console pulls. The room keeps 500. */
const CHAT_WINDOW = 60;

interface AdminPageProps {
  onNavigateDashboard: () => void;
}

export function AdminPage({ onNavigateDashboard }: AdminPageProps) {
  const [token, setToken] = useState<string | null>(() => readAdminToken());

  const signOut = useCallback(() => {
    clearAdminToken();
    setToken(null);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-mid)]">
        <button
          type="button"
          onClick={onNavigateDashboard}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← 대시보드
        </button>
        {/*
          While locked the page names nothing. A visitor who guesses the hash
          finds an unlabelled password box rather than a signposted admin
          console. The password is still the boundary — this only removes the
          invitation.
        */}
        <h1 className="text-sm font-semibold flex items-center gap-1.5">
          {token ? (
            <>
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              관리
            </>
          ) : (
            BRAND_NAME
          )}
        </h1>
        {token ? (
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            잠금
          </button>
        ) : (
          <span className="w-12" aria-hidden="true" />
        )}
      </header>

      <main className="px-4 py-6 max-w-3xl mx-auto pb-20">
        {token ? (
          <Console token={token} onUnauthorized={signOut} />
        ) : (
          <PasswordGate
            onUnlocked={(value) => {
              writeAdminToken(value);
              setToken(value);
            }}
          />
        )}
      </main>
    </div>
  );
}

// ── Password gate ───────────────────────────────────────────────────────────

function PasswordGate({ onUnlocked }: { onUnlocked: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (checking || value.trim().length === 0) return;

    setChecking(true);
    setError(null);

    try {
      // The server decides. It answers with the bearer token the console then
      // uses for every action — the password itself is never that token.
      onUnlocked(await adminLogin(value.trim()));
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : "확인에 실패했습니다. 다시 시도해주세요.",
      );
      setValue("");
    } finally {
      setChecking(false);
    }
  };

  if (!isAdminConfigured) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        지금은 사용할 수 없습니다.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-xs mx-auto mt-10 space-y-3">
      <label
        htmlFor="admin-password"
        className="block text-sm text-[var(--text-secondary)]"
      >
        비밀번호
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={checking}
        className="w-full min-h-[44px] px-3 rounded-lg bg-surface-2 border border-[var(--border-strong)] text-[var(--text-primary)] focus:outline-none focus:border-[#8b7cff]"
      />
      {error && (
        <p role="alert" className="text-xs text-[#ff5d6c]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={checking || value.trim().length === 0}
        className="w-full min-h-[44px] rounded-lg text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)" }}
      >
        {checking ? "확인 중..." : "확인"}
      </button>
    </form>
  );
}

// ── Console ─────────────────────────────────────────────────────────────────

type Tab = "chat" | "posts" | "comments";

function Console({
  token,
  onUnauthorized,
}: {
  token: string;
  /** Called when the token stops being accepted — e.g. it was rotated. */
  onUnauthorized: () => void;
}) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {(
          [
            ["chat", "실시간 채팅"],
            ["posts", "게시글"],
            ["comments", "댓글"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[36px] px-3 rounded-lg text-sm transition-colors ${
              tab === id
                ? "bg-[rgba(139,124,255,0.14)] text-[var(--text-primary)]"
                : "bg-surface-2 text-[var(--text-secondary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && <ChatPanel token={token} onUnauthorized={onUnauthorized} />}
      {tab === "posts" && <PostPanel token={token} onUnauthorized={onUnauthorized} />}
      {tab === "comments" && (
        <CommentPanel token={token} onUnauthorized={onUnauthorized} />
      )}
    </div>
  );
}

/** Shared plumbing: load, surface errors, sign out on a 401. */
function useAdminList<T>(
  load: () => Promise<T>,
  onUnauthorized: () => void,
  deps: unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await load());
    } catch (err) {
      if (err instanceof AdminApiError && err.kind === "unauthorized") {
        onUnauthorized();
        return;
      }
      setError(
        err instanceof AdminApiError ? err.message : "불러오지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
    // load is recreated per render by design; deps decide when to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, busy, refresh, setError };
}

function Toolbar({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] min-h-[32px] disabled:opacity-50"
    >
      <RefreshCw
        className={`w-3.5 h-3.5${busy ? " animate-spin" : ""}`}
        aria-hidden="true"
      />
      새로고침
    </button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="p-3 rounded-xl bg-surface-2 border border-[var(--border-subtle)] space-y-2">
      {children}
    </li>
  );
}

function ActionButton({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-lg text-xs border transition-colors ${
        danger
          ? "text-[#ff5d6c] border-[#ff5d6c]/30 hover:bg-[#ff5d6c]/10"
          : "text-[var(--text-secondary)] border-[var(--border-strong)] hover:bg-[var(--surface-overlay)]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Chat ────────────────────────────────────────────────────────────────────

function ChatPanel({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const { data, error, busy, refresh, setError } = useAdminList(
    () => fetchChatLines(token, CHAT_WINDOW),
    onUnauthorized,
    [token],
  );

  const remove = async (target: { ids: string[] } | { handle: string }) => {
    try {
      await deleteChatLines(token, target);
      await refresh();
    } catch (err) {
      if (err instanceof AdminApiError && err.kind === "unauthorized") {
        onUnauthorized();
        return;
      }
      setError(err instanceof AdminApiError ? err.message : "삭제하지 못했습니다.");
    }
  };

  const messages: ChatMessage[] = data?.messages ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          최근 {messages.length}줄 · 접속 {data?.participants ?? 0}
        </p>
        <Toolbar busy={busy} onRefresh={() => void refresh()} />
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#ff5d6c]">
          {error}
        </p>
      )}

      {messages.length === 0 && !busy && (
        <p className="text-sm text-[var(--text-secondary)]">표시할 대화가 없습니다.</p>
      )}

      <ul className="space-y-2">
        {[...messages].reverse().map((message) => (
          <Row key={message.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {message.handle}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {formatKoreanTime(message.createdAt)}
              </span>
            </div>
            <p className="text-sm break-words">{message.body}</p>
            <div className="flex gap-2">
              <ActionButton danger onClick={() => void remove({ ids: [message.id] })}>
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />이 줄 삭제
              </ActionButton>
              <ActionButton
                onClick={() => {
                  // Anonymous aliases are drawn from only 1,600 adjective+noun
                  // combinations, so one handle can be several people — a
                  // by-handle sweep may take strangers' lines with it, and
                  // like the post delete below it cannot be undone.
                  if (
                    window.confirm(
                      `"${message.handle}"의 대화를 모두 삭제할까요? 같은 별칭을 쓰는 다른 사용자의 대화도 함께 지워질 수 있으며, 되돌릴 수 없습니다.`,
                    )
                  ) {
                    void remove({ handle: message.handle });
                  }
                }}
              >
                이 사용자 전체 삭제
              </ActionButton>
            </div>
          </Row>
        ))}
      </ul>
    </section>
  );
}

// ── Posts ───────────────────────────────────────────────────────────────────

function PostPanel({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const [filter, setFilter] = useState<PostFilter>("reported");
  const { data, error, busy, refresh, setError } = useAdminList(
    () => fetchAdminPosts(token, filter),
    onUnauthorized,
    [token, filter],
  );

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await refresh();
    } catch (err) {
      if (err instanceof AdminApiError && err.kind === "unauthorized") {
        onUnauthorized();
        return;
      }
      setError(err instanceof AdminApiError ? err.message : "처리하지 못했습니다.");
    }
  };

  const posts: AdminPost[] = data?.posts ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(
            [
              ["reported", "신고됨"],
              ["hidden", "숨김"],
              ["all", "전체"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`min-h-[32px] px-2.5 rounded-lg text-xs ${
                filter === id
                  ? "bg-[rgba(139,124,255,0.14)] text-[var(--text-primary)]"
                  : "bg-surface-2 text-[var(--text-tertiary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Toolbar busy={busy} onRefresh={() => void refresh()} />
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#ff5d6c]">
          {error}
        </p>
      )}

      {posts.length === 0 && !busy && (
        <p className="text-sm text-[var(--text-secondary)]">해당하는 글이 없습니다.</p>
      )}

      <ul className="space-y-2">
        {posts.map((post) => (
          <Row key={post.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {post.authorTag}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                신고 {post.reportCount}
                {post.hiddenAt ? " · 숨김" : ""}
              </span>
            </div>
            <p className="text-sm break-words whitespace-pre-wrap">{post.body}</p>
            <div className="flex flex-wrap gap-2">
              {post.hiddenAt ? (
                <ActionButton onClick={() => void act(() => unhidePost(token, post.id))}>
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  다시 보이기
                </ActionButton>
              ) : (
                <ActionButton onClick={() => void act(() => hidePost(token, post.id))}>
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  숨기기
                </ActionButton>
              )}
              <ActionButton
                danger
                onClick={() => {
                  // Deleting a post takes its comments with it and cannot be
                  // undone, unlike hiding.
                  if (window.confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) {
                    void act(() => deletePost(token, post.id));
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                삭제
              </ActionButton>
            </div>
          </Row>
        ))}
      </ul>
    </section>
  );
}

// ── Comments ────────────────────────────────────────────────────────────────

function CommentPanel({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const [filter, setFilter] = useState<PostFilter>("reported");
  const { data, error, busy, refresh, setError } = useAdminList(
    () => fetchAdminComments(token, filter),
    onUnauthorized,
    [token, filter],
  );

  const remove = async (id: string) => {
    try {
      await deleteComment(token, id);
      await refresh();
    } catch (err) {
      if (err instanceof AdminApiError && err.kind === "unauthorized") {
        onUnauthorized();
        return;
      }
      setError(err instanceof AdminApiError ? err.message : "삭제하지 못했습니다.");
    }
  };

  const comments: AdminComment[] = data?.comments ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(
            [
              ["reported", "신고됨"],
              ["all", "전체"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`min-h-[32px] px-2.5 rounded-lg text-xs ${
                filter === id
                  ? "bg-[rgba(139,124,255,0.14)] text-[var(--text-primary)]"
                  : "bg-surface-2 text-[var(--text-tertiary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Toolbar busy={busy} onRefresh={() => void refresh()} />
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#ff5d6c]">
          {error}
        </p>
      )}

      {comments.length === 0 && !busy && (
        <p className="text-sm text-[var(--text-secondary)]">해당하는 댓글이 없습니다.</p>
      )}

      <ul className="space-y-2">
        {comments.map((comment) => (
          <Row key={comment.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {comment.authorTag}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                글 #{comment.postId} · 신고 {comment.reportCount}
              </span>
            </div>
            <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
            <ActionButton danger onClick={() => void remove(comment.id)}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              삭제
            </ActionButton>
          </Row>
        ))}
      </ul>
    </section>
  );
}
