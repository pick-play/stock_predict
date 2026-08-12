/**
 * Mobile overflow menu for the header's non-status controls.
 *
 * Theme, board and chat move in here on small screens. The header also carries
 * the market-state and connection badges, and those are the reason the menu
 * exists: on a phone the badges are the only items a reader actually needs at a
 * glance, and five inline controls squeezed them to the point of illegibility.
 * Navigation and theme are things you go looking for, so they can cost a tap.
 *
 * Desktop keeps the controls inline — there is room, and a menu would add a tap
 * for nothing.
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../hooks/useTheme";

interface HeaderMenuProps {
  onNavigateBoard?: () => void;
  onNavigateChat?: () => void;
}

function BoardIcon() {
  return (
    <svg
      width="13"
      height="13"
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
  );
}

function ChatIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 10h8M8 14h5" />
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ITEM_CLASS =
  "flex w-full min-h-[44px] items-center gap-2.5 px-3 text-left text-xs text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:bg-[var(--surface-overlay)]";

export function HeaderMenu({
  onNavigateBoard,
  onNavigateChat,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  // Dismiss on an outside press or Escape. Without both, a menu on a phone is a
  // trap: there is no hover to reveal that tapping elsewhere would close it.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const themeLabel = theme === "dark" ? "라이트 모드" : "다크 모드";

  return (
    <div ref={containerRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="메뉴"
        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-tertiary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="메뉴"
          /*
           * --surface-menu rather than --surface-2: both surface tokens sit only
           * a few steps from --bg, so a panel painted with one read as
           * see-through against the page even though it was fully opaque. A
           * dedicated token, a strong border and a deep shadow give the panel an
           * edge instead of asking the reader to find one.
           */
          className="animate-fade-in absolute right-0 top-[calc(100%+6px)] z-50 w-40 overflow-hidden rounded-xl border border-[var(--border-strong)] py-1 shadow-2xl shadow-black/40"
          style={{ backgroundColor: "var(--surface-menu)" }}
        >
          {onNavigateBoard && (
            <button
              type="button"
              role="menuitem"
              className={ITEM_CLASS}
              onClick={() => {
                setOpen(false);
                onNavigateBoard();
              }}
            >
              <BoardIcon />
              커뮤니티
            </button>
          )}

          {onNavigateChat && (
            <button
              type="button"
              role="menuitem"
              className={ITEM_CLASS}
              onClick={() => {
                setOpen(false);
                onNavigateChat();
              }}
            >
              <ChatIcon />
              실시간 채팅
            </button>
          )}

          {/* Stays open: a reader flipping the theme wants to see the result and
              may well flip straight back. */}
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={toggle}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            {themeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
