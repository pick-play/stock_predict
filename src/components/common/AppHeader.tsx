import { ConnectionBadge } from "./ConnectionBadge";
import { HeaderMenu } from "./HeaderMenu";
import { ThemeToggle } from "./ThemeToggle";
import { MarketStatusBadge } from "./MarketStatusBadge";
import type { WsConnectionStatus } from "../../lib/binance/websocketAdapter";
import { BRAND_NAME, BRAND_NAME_LATIN } from "../../config/brand";

interface AppHeaderProps {
  isLoading: boolean;
  usingFallback: boolean;
  lastUpdated: string | null;
  wsStatus?: WsConnectionStatus;
  onNavigateBoard?: () => void;
  /**
   * Optional so the header renders unchanged where the chat route is not
   * mounted. DashboardPage has to pass it for the button to appear.
   */
  onNavigateChat?: () => void;
}

export function AppHeader({
  isLoading,
  usingFallback,
  lastUpdated,
  wsStatus,
  onNavigateBoard,
  onNavigateChat,
}: AppHeaderProps) {
  return (
    /*
     * relative z-40 is load-bearing, not decoration.
     *
     * animate-fade-in animates opacity with fill-mode both, which makes this
     * element a stacking context for as long as the animation applies. Left
     * static, the whole header subtree — including the overflow menu's z-50
     * panel — painted as one unit at the header's place in the order, and <main>
     * comes later in the DOM, so the page content covered the open menu. The
     * panel was both invisible where they overlapped and unclickable, because
     * the taps landed on the content in front of it.
     */
    <header className="animate-fade-in relative z-40 flex items-center justify-between py-4 px-4 md:px-6 border-b border-[var(--border-mid)]">
      {/* Logo mark */}
      <div className="flex items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}favicon-48.png`}
          alt=""
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg flex-shrink-0"
          aria-hidden="true"
        />
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-none tracking-tight">
            {BRAND_NAME}
          </h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 tracking-wide">
            {BRAND_NAME_LATIN}
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <span className="hidden md:inline-flex">
          <ThemeToggle />
        </span>
        <MarketStatusBadge />
        <ConnectionBadge
          isLoading={isLoading}
          usingFallback={usingFallback}
          lastUpdated={lastUpdated}
          wsStatus={wsStatus}
        />
        {/*
          The header's own "N초 전" is gone (owner decision, 2026-08-17).
          It sat next to a 실시간 badge that already means "the feed is current",
          and each stock card carries the age of the price it is showing — so the
          header's copy read 0초 전 nearly always and said nothing the badge
          beside it had not. It was desktop-only, which is where it was noise.
        */}
        {onNavigateBoard && (
          <button
            type="button"
            onClick={onNavigateBoard}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            aria-label="커뮤니티 열기"
          >
            <svg
              width="11"
              height="11"
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
            <span>커뮤니티</span>
          </button>
        )}
        {onNavigateChat && (
          <button
            type="button"
            onClick={onNavigateChat}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            aria-label="실시간 채팅 열기 (로그인 없이 참여)"
          >
            <svg
              width="11"
              height="11"
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
            <span>실시간 채팅</span>
          </button>
        )}

        <HeaderMenu
          onNavigateBoard={onNavigateBoard}
          onNavigateChat={onNavigateChat}
        />
      </div>
    </header>
  );
}
