import { useState, useCallback } from "react";
import { useBoardPosts } from "../../hooks/useBoardPosts";
import { useAuth } from "../../hooks/useAuth";
import { isBoardConfigured } from "../../lib/board/api";
import { BoardNotReady } from "./BoardNotReady";
import { PostCard } from "./PostCard";
import { PostForm } from "./PostForm";
import { AuthModal } from "./auth/AuthModal";
import { RecoveryCodeModal } from "./auth/RecoveryCodeModal";
import type { BoardPost, SignupResult } from "../../types/board";
import { DashboardLayout } from "../layout/DashboardLayout";

interface BoardPageProps {
  onNavigateDashboard: () => void;
  /** Optional so the board still renders if the chat route is not mounted. */
  onNavigateChat?: () => void;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PostListSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="글 목록 불러오는 중"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex justify-between mb-3">
            <div className="h-2.5 w-20 rounded bg-[var(--surface-3)]" />
            <div className="h-2.5 w-14 rounded bg-[var(--surface-3)]" />
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded bg-[var(--surface-3)]" />
            <div className="h-2.5 w-3/4 rounded bg-[var(--surface-3)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BoardPage({
  onNavigateDashboard,
  onNavigateChat,
}: BoardPageProps) {
  const { posts, isLoading, error, hasMore, loadMore, prependPost } =
    useBoardPosts();
  const auth = useAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState<SignupResult | null>(null);

  const handlePostCreated = (post: BoardPost) => {
    prependPost(post);
  };

  const handleOpenAuth = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const handleCloseAuth = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const handleRecoveryCode = useCallback((result: SignupResult) => {
    setAuthModalOpen(false);
    setPendingRecovery(result);
  }, []);

  const handleRecoveryConfirmed = useCallback(() => {
    setPendingRecovery(null);
  }, []);

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <header className="animate-fade-in flex items-center justify-between py-4 px-4 md:px-6 border-b border-[var(--border-mid)]">
        <div className="flex items-center gap-3">
          {/* Back to dashboard */}
          <button
            type="button"
            onClick={onNavigateDashboard}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-overlay)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            aria-label="KOSPI NOW 대시보드로 돌아가기"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-[var(--text-secondary)]"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>

          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-none tracking-tight">
              토론방
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              KOSPI NOW · 참고 의견 공유
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Chat entry. The board requires login to write; the chat room does
              not (CLAUDE.md §28.3), so the label says so up front. */}
          {onNavigateChat && (
            <button
              type="button"
              onClick={onNavigateChat}
              aria-label="실시간 채팅방 열기 (로그인 없이 참여)"
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[10px] font-medium text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              채팅방
            </button>
          )}
          {isLoading && posts.length > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#f5b942] animate-pulse"
              aria-label="갱신 중"
              aria-hidden="true"
            />
          )}
          {/* Auth button — shows login state or triggers auth modal */}
          {isBoardConfigured && (
            <button
              type="button"
              onClick={handleOpenAuth}
              aria-label={
                auth.status === "authenticated"
                  ? `내 계정: ${auth.nickname ?? ""}`
                  : "로그인 또는 가입"
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
              style={{
                borderColor:
                  auth.status === "authenticated"
                    ? "rgba(139,124,255,0.3)"
                    : "var(--border-subtle)",
                color:
                  auth.status === "authenticated"
                    ? "#8b7cff"
                    : "var(--text-muted)",
                background:
                  auth.status === "authenticated"
                    ? "rgba(139,124,255,0.07)"
                    : "transparent",
              }}
            >
              {auth.status === "checking" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" aria-hidden="true" />
              ) : auth.status === "authenticated" ? (
                <>
                  <span aria-hidden="true">◆</span>
                  <span className="max-w-[80px] truncate">{auth.nickname}</span>
                </>
              ) : (
                "로그인"
              )}
            </button>
          )}
          {!isBoardConfigured && (
            <span className="text-[10px] text-[var(--text-muted)]">
              준비 중
            </span>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="px-4 md:px-6 pb-16 pt-4 space-y-4">
        {!isBoardConfigured ? (
          <BoardNotReady />
        ) : (
          <>
            {/* Writing requires an account; reading stays open to everyone. */}
            {auth.token ? (
              <PostForm
                onPostCreated={handlePostCreated}
                authToken={auth.token}
                authorNickname={auth.nickname}
              />
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-5 text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                  글을 쓰려면 로그인해주세요.
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  닉네임과 비밀번호만 있으면 됩니다. 읽는 것은 로그인 없이도 가능합니다.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="mt-3 min-h-[44px] px-5 rounded-lg text-sm font-medium bg-[#8b7cff] text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
                >
                  로그인 / 가입
                </button>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div
                className="animate-slide-fade-in rounded-xl border border-[rgba(255,93,108,0.18)] bg-[rgba(255,93,108,0.05)] px-4 py-3"
                role="alert"
              >
                <p className="text-xs text-[#ff5d6c]">{error}</p>
              </div>
            )}

            {/* Post list */}
            {isLoading && posts.length === 0 ? (
              <PostListSkeleton />
            ) : !isLoading && posts.length === 0 ? (
              <div className="animate-slide-fade-in text-center py-16">
                <p className="text-sm text-[var(--text-tertiary)]">
                  아직 글이 없습니다.
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  첫 번째 글을 남겨보세요.
                </p>
              </div>
            ) : (
              <section
                aria-label="토론 글 목록"
                aria-busy={isLoading}
              >
                <div className="space-y-3">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      authToken={auth.token}
                      authorNickname={auth.nickname}
                      onOpenAuth={handleOpenAuth}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Load more */}
            {hasMore && !isLoading && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  className="px-5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
                  aria-label="더 많은 글 불러오기"
                >
                  더 보기
                </button>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-[var(--text-muted)] text-center pt-2 leading-relaxed">
              이 게시판은 익명이며 투자 권유가 아닙니다. 부적절한 게시물은
              신고해 주세요.
            </p>
          </>
        )}
      </main>
      {/* Auth modal — login / signup / reset / account */}
      {authModalOpen && (
        <AuthModal
          auth={auth}
          onClose={handleCloseAuth}
          onRecoveryCode={handleRecoveryCode}
        />
      )}

      {/* Recovery code modal — shown once after signup; cannot be skipped */}
      {pendingRecovery && (
        <RecoveryCodeModal
          recoveryCode={pendingRecovery.recoveryCode}
          nickname={pendingRecovery.nickname}
          onConfirmed={handleRecoveryConfirmed}
        />
      )}
    </DashboardLayout>
  );
}
