/**
 * The chat room as a panel over the dashboard.
 *
 * Owner decision, 2026-08-22. Leaving the page to say one thing and coming back
 * to the prices is a lot of ceremony for a room that is mostly read in glances,
 * so the same room now opens in place — full screen on a phone, a floating
 * panel beside the cards on a desktop.
 *
 * It mounts nothing until it is open. The socket, the join ticket and the room
 * itself all come from `useChatRoom` inside this component, so a reader who
 * never taps the button never wakes the Durable Object — which is the same rule
 * that keeps the dashboard's preview strip on polling rather than a socket
 * (§28.3). Closing unmounts it and the socket goes with it.
 *
 * Rendered through a portal into <body>: the dashboard's cards are
 * `overflow-hidden` with transforms on them, which clips a fixed child and traps
 * its z-index (the same trap §28.4 hit with the share preview).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChatRoom } from "../../hooks/useChatRoom";
import { useAuth } from "../../hooks/useAuth";
import { CHAT_MESSAGE_CAP } from "../../lib/chat/config";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatNotReady } from "./ChatNotReady";
import { ParticipantCount } from "./ParticipantCount";
import type { ChatConnectionStatus } from "../../types/chat";
import { StockMiniCards } from "../common/StockMiniCards";
import { publishLivePreview } from "../../lib/chat/livePreview";

interface ChatPopupProps {
  onClose: () => void;
  /** Opens the full page, for a reader who wants the room to itself. */
  onExpand?: () => void;
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

export function ChatPopup({ onClose, onExpand }: ChatPopupProps) {
  const auth = useAuth();
  const room = useChatRoom({ authToken: auth.token });
  const isConnected = room.status === "open";
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Hand the socket's lines to the strip behind the panel.
   *
   * Both show the same room, and the strip is on a 20-second poll behind a
   * 10-second server cache — so a line sent here could take half a minute to
   * appear a few hundred pixels above, which reads as one of them being broken.
   */
  useEffect(() => {
    publishLivePreview(room.messages, room.participants);
  }, [room.messages, room.participants]);

  /*
   * Escape closes, and focus goes back where it came from.
   *
   * A panel that swallows the keyboard and then drops focus at the top of the
   * document leaves a keyboard reader to find their place again.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label="실시간 채팅"
      /*
       * A sheet on a phone, a panel on a desktop.
       *
       * Full screen is the only honest size on a phone: the keyboard takes half
       * the viewport, and a floating card would be reduced to two visible lines.
       * On a desktop the point is to keep the prices in view, so it stays out of
       * the way in the corner.
       */
      className="fixed inset-0 z-50 flex flex-col border-[var(--border-strong)] bg-[var(--surface-1)] outline-none md:inset-auto md:bottom-6 md:right-6 md:h-[34rem] md:w-[26rem] md:rounded-2xl md:border md:shadow-2xl md:shadow-black/40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-mid)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[var(--text-primary)]">
            실시간 채팅
          </h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: STATUS_COLOR[room.status] }}
              role="status"
              aria-label={STATUS_LABEL[room.status]}
            />
            {room.handle ? (
              <span className="truncate text-[var(--text-muted)]">
                <span className="font-medium text-[#8b7cff]">{room.handle}</span>
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

        <div className="flex shrink-0 items-center gap-1.5">
          <ParticipantCount
            participants={room.participants}
            isLive={isConnected}
          />
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label="채팅 전체 화면으로 보기"
              className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            >
              전체
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="채팅 닫기"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M1 1 L13 13 M13 1 L1 13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/*
        Prices, on the phone only.
        
        The sheet covers the whole screen there, so the cards the reader came
        from are gone and the room needs to carry them — the same reason the
        full page does (§28.3). The desktop panel floats over a dashboard that
        is still showing them, and two more cards inside a 34rem box would take
        a third of the conversation for a number already on screen.

        Held back until the room is open, like the page does it: StockMiniCards
        starts the whole market feed, and mounting it alongside the join makes
        entering the room feel slow on a phone.
      */}
      {isConnected && (
        <div className="md:hidden">
          <StockMiniCards onNavigateDashboard={onClose} />
        </div>
      )}

      {room.status === "unavailable" ? (
        <ChatNotReady />
      ) : (
        <>
          {/* Fills whatever the panel has left, rather than the page's fixed
              height — a sheet and a 34rem panel are not the same box. */}
          <ChatMessageList
            messages={room.messages}
            ownHandle={room.handle}
            heightClass="min-h-0 flex-1"
          />

          <ChatComposer
            onSend={room.send}
            notice={room.notice}
            onClearNotice={room.clearNotice}
            isConnected={isConnected}
          />

          {/* §28.3: the room says what it is, wherever it is shown. */}
          <p className="shrink-0 px-4 pb-3 pt-2 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            최근 {CHAT_MESSAGE_CAP}개만 보관됩니다. 투자 권유가 아닙니다.
          </p>
        </>
      )}
    </div>,
    document.body
  );
}

/**
 * The button that opens it, and the panel's open state.
 *
 * One component so the dashboard mounts one thing. The panel is not rendered at
 * all while closed, which is what keeps a visitor who never taps it off the
 * room's socket.
 */
export function ChatLauncher({ onExpand }: { onExpand?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="실시간 채팅 열기"
          /*
           * Above the phone's market tape and its home indicator; the install
           * button stacks above this one, so the two never overlap.
           */
          className="fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-[#8b7cff] px-4 text-sm font-semibold text-white shadow-lg shadow-[rgba(139,124,255,0.35)] transition-transform duration-150 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] md:right-6 md:bottom-6"
          style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M2.5 4.2a1.7 1.7 0 0 1 1.7-1.7h9.6a1.7 1.7 0 0 1 1.7 1.7v6.4a1.7 1.7 0 0 1-1.7 1.7H7.2L3.6 15.2v-2.9a1.7 1.7 0 0 1-1.1-1.6z"
              fill="currentColor"
            />
          </svg>
          채팅
        </button>
      )}

      {open && (
        <ChatPopup onClose={() => setOpen(false)} onExpand={onExpand} />
      )}
    </>
  );
}
