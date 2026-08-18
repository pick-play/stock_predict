/**
 * Real-time chat room.
 *
 * Login-free by owner decision of 2026-08-10 (CLAUDE.md §28.3). The board's
 * login requirement is untouched — only this room is anonymous. The entry
 * CAPTCHA was removed the same day for the seconds it cost on a phone, so the
 * defences that replace an account are the per-IP-hash send limit, the shared
 * moderation filter, and a per-IP-hash cap on concurrent sockets.
 */

import { useState } from "react";
import { useChatRoom } from "../../hooks/useChatRoom";
import { useAuth } from "../../hooks/useAuth";
import { AccountButton } from "../common/AccountButton";
import { BackButton } from "../common/BackButton";
import { AuthModal } from "../board/auth/AuthModal";
import { RecoveryCodeModal } from "../board/auth/RecoveryCodeModal";
import type { SignupResult } from "../../types/board";
import { DashboardLayout } from "../layout/DashboardLayout";
import { CHAT_MESSAGE_CAP } from "../../lib/chat/config";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatNotReady } from "./ChatNotReady";
import { ParticipantCount } from "./ParticipantCount";
import type { ChatConnectionStatus } from "../../types/chat";
import { StockMiniCards } from "../common/StockMiniCards";

interface ChatPageProps {
  onNavigateDashboard: () => void;
}

/** Status text and dot colour. Never colour alone — the label always shows. */
const STATUS_LABEL: Record<ChatConnectionStatus, string> = {
  gated: "연결 준비 중…",
  connecting: "연결 중…",
  open: "실시간 연결",
  reconnecting: "재연결 중…",
  closed: "연결 끊김",
  unavailable: "준비 중",
};

const STATUS_COLOR: Record<ChatConnectionStatus, string> = {
  gated: "#f5b942",
  connecting: "#f5b942",
  open: "#31c48d",
  reconnecting: "#f5b942",
  closed: "#ff5d6c",
  unavailable: "var(--text-muted)",
};

export function ChatPage({ onNavigateDashboard }: ChatPageProps) {
  /*
   * The session decides the display name.
   *
   * A logged-in member chats under their fixed nickname; everyone else keeps the
   * daily alias the server derives from an IP hash. The token is only handed to
   * the ticket request — the room itself never receives it — and the name comes
   * back signed, so nothing here can claim a name it was not given.
   */
  const auth = useAuth();
  const room = useChatRoom({ authToken: auth.token });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  /**
   * Held after a signup so the recovery code can be shown once.
   *
   * Not optional: it is the only way back into an account whose password is
   * lost, and a member who signed up from the chat room must not be the one
   * reader who never sees it.
   */
  const [pendingRecovery, setPendingRecovery] = useState<SignupResult | null>(
    null
  );
  const isConnected = room.status === "open";

  return (
    <DashboardLayout>
      <div className="flex flex-col">
        {/* ── Header ── */}
        <header className="animate-fade-in shrink-0 border-b border-[var(--border-mid)] px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BackButton onClick={onNavigateDashboard} />

              <div className="min-w-0">
                <h1 className="truncate text-base font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                  실시간 채팅
                </h1>
                {/*
                  The subtitle used to read "코스피 NOW · 로그인 없이 참여 가능":
                  the brand, to somebody already inside the site, and a rule that
                  stops being news the moment you are in the room. It now carries
                  the one thing a reader here wants to know — the name they are
                  speaking under — with the connection state as a dot beside it.
                */}
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[room.status] }}
                    role="status"
                    aria-label={STATUS_LABEL[room.status]}
                  />
                  {room.handle ? (
                    <span className="truncate text-[var(--text-muted)]">
                      <span className="font-medium text-[#8b7cff]">
                        {room.handle}
                      </span>
                      {auth.nickname ? " · 고정 닉네임" : " · 익명"}
                    </span>
                  ) : (
                    <span
                      className="truncate"
                      style={{ color: STATUS_COLOR[room.status] }}
                    >
                      {STATUS_LABEL[room.status]}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ParticipantCount
                participants={room.participants}
                isLive={isConnected}
              />
              {/*
                The room says a login fixes your nickname and until now offered no
                way to do it — the only route was to leave for the community, sign
                in and come back.
              */}
              <AccountButton auth={auth} onOpen={() => setAuthModalOpen(true)} />
            </div>
          </div>

          {/* Shown only to a reader who could still gain something by logging in. */}
          {!auth.nickname && room.handle && (
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
              로그인하면 이 이름 대신 내 닉네임으로 참여합니다.
            </p>
          )}
        </header>

        {/*
         * Held back until the room is actually open.
         *
         * StockMiniCards runs the full market feed — a baseline read, two kline
         * requests, two quote requests and a Binance socket. Mounted alongside
         * the join it competed with the ticket round-trip and the socket upgrade
         * for a phone's connection, which is what made entering the room feel
         * slow. The prices are context here, not the point of the page, so they
         * can arrive after the conversation does.
         */}
        {isConnected && (
          <StockMiniCards onNavigateDashboard={onNavigateDashboard} />
        )}

        {/* ── Body ── */}
        {room.status === "unavailable" ? (
          <ChatNotReady />
        ) : (
          <>
            <ChatMessageList messages={room.messages} ownHandle={room.handle} />

            <ChatComposer
              onSend={room.send}
              notice={room.notice}
              onClearNotice={room.clearNotice}
              isConnected={isConnected}
            />

            <p className="shrink-0 px-4 pb-4 pt-2 text-center text-[12px] leading-relaxed text-[var(--text-muted)] md:px-6">
              최근 {CHAT_MESSAGE_CAP}개의 대화만 보관되며 오래된 대화는 자동으로
              사라집니다. 이 채팅은 익명이며 투자 권유가 아닙니다.
            </p>
          </>
        )}
      </div>

      {authModalOpen && (
        <AuthModal
          auth={auth}
          onClose={() => setAuthModalOpen(false)}
          onRecoveryCode={(result) => {
            setAuthModalOpen(false);
            setPendingRecovery(result);
          }}
        />
      )}

      {pendingRecovery && (
        <RecoveryCodeModal
          recoveryCode={pendingRecovery.recoveryCode}
          nickname={pendingRecovery.nickname}
          onConfirmed={() => setPendingRecovery(null)}
        />
      )}
    </DashboardLayout>
  );
}
