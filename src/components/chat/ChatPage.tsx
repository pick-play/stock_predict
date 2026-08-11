/**
 * Real-time chat room.
 *
 * Login-free by owner decision of 2026-08-10 (CLAUDE.md §28.3). The board's
 * login requirement is untouched — only this room is anonymous. The entry
 * CAPTCHA was removed the same day for the seconds it cost on a phone, so the
 * defences that replace an account are the per-IP-hash send limit, the shared
 * moderation filter, and a per-IP-hash cap on concurrent sockets.
 */

import { useChatRoom } from "../../hooks/useChatRoom";
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
  const room = useChatRoom();
  const isConnected = room.status === "open";

  return (
    <DashboardLayout>
      <div className="flex flex-col">
        {/* ── Header ── */}
        <header className="animate-fade-in shrink-0 border-b border-[var(--border-mid)] px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={onNavigateDashboard}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
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

              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold leading-none tracking-tight text-[var(--text-primary)]">
                  실시간 채팅
                </h1>
                <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">
                  KOSPI NOW · 로그인 없이 참여
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ParticipantCount
                participants={room.participants}
                isLive={isConnected}
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="flex items-center gap-1.5 text-[12px]"
              role="status"
              aria-live="polite"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: STATUS_COLOR[room.status] }}
                aria-hidden="true"
              />
              <span style={{ color: STATUS_COLOR[room.status] }}>
                {STATUS_LABEL[room.status]}
              </span>
            </span>

            {room.handle && (
              <span className="text-[12px] text-[var(--text-muted)]">
                내 이름 <span className="text-[#8b7cff]">{room.handle}</span> ·
                같은 이름의 메시지가 강조됩니다
              </span>
            )}
          </div>
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
    </DashboardLayout>
  );
}
