import { ConnectionBadge } from "./ConnectionBadge";
import { HeaderMenu } from "./HeaderMenu";
import { ThemeToggle } from "./ThemeToggle";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { PILL_SURFACE } from "./controls";
import { AccountButton } from "./AccountButton";
import type { UseAuthReturn } from "../../hooks/useAuth";
import type { WsConnectionStatus } from "../../lib/binance/websocketAdapter";
import { BRAND_NAME_KO, BRAND_NAME_NOW } from "../../config/brand";

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
  /**
   * Opens the account panel. Optional for the same reason as the routes above:
   * a page without an auth modal to open must not show a control that opens it.
   */
  auth?: UseAuthReturn;
  onOpenAuth?: () => void;
}

/**
 * The header's navigation pills.
 *
 * Same shape as the back and account controls on the subpages — 36px tall,
 * fully rounded, a surface of their own rather than an outline on the page
 * background. They used to be 28px outlined rectangles with 11px icons, which
 * read as disabled next to the status badges beside them.
 */
const NAV_BUTTON_CLASS = `hidden md:inline-flex ${PILL_SURFACE}`;

export function AppHeader({
  isLoading,
  usingFallback,
  lastUpdated,
  wsStatus,
  onNavigateBoard,
  onNavigateChat,
  auth,
  onOpenAuth,
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
    <header className="animate-fade-in relative z-40 px-4 md:px-6">
      {/*
        The rule sits on this inner row, not on the header itself.
        
        With the border on the padded element it ran the full width of the
        container while every card below started 16px in, so the line stuck out
        past the content on both sides. Now it spans exactly the column the
        cards occupy.
      */}
      <div className="flex items-center justify-between pt-5 pb-3.5 border-b border-[var(--border-mid)]">
      {/*
        A wordmark, and nothing else (owner decision, 2026-08-22).
        
        The icon and the "KOSPI NOW" line under it are gone: three renderings of
        one name stacked in a corner, where the site already announces itself by
        being open. What is left is set as a mark rather than a label — 코스피 in
        the text colour, NOW in the brand violet — so it reads as an identity at
        one line instead of needing a picture to carry it.
        
        The Latin spelling moved to the footer rather than disappearing: it is
        the domain, and a search engine only matches text it can find.
      */}
      <h1 className="flex shrink-0 items-baseline text-xl md:text-2xl font-extrabold tracking-tight leading-none">
        <span className="text-[var(--text-primary)]">{BRAND_NAME_KO}</span>
        {/* A real space, so the DOM text reads "코스피 NOW" — the brand's own
            spelling (§28.1) — for copy-paste, accessible names and crawlers.
            It renders nothing: a whitespace-only text node in a flex container
            makes no box, so ml-1 stays the sole visual gap and nothing doubles. */}
        {" "}
        <span className="ml-1 text-[#8b7cff]">{BRAND_NAME_NOW}</span>
      </h1>

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
            className={NAV_BUTTON_CLASS}
            aria-label="커뮤니티 열기"
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
            className={NAV_BUTTON_CLASS}
            aria-label="실시간 채팅 열기 (로그인 없이 참여)"
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
            >
              <path d="M8 10h8M8 14h5" />
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>실시간 채팅</span>
          </button>
        )}

        {/* Desktop only: on a phone this lives in the overflow menu, where the
            other two navigation items already went. */}
        {auth && onOpenAuth && (
          <span className="hidden md:inline-flex">
            <AccountButton auth={auth} onOpen={onOpenAuth} />
          </span>
        )}

        <HeaderMenu
          onNavigateBoard={onNavigateBoard}
          onNavigateChat={onNavigateChat}
          nickname={auth?.status === "authenticated" ? auth.nickname : null}
          onOpenAuth={onOpenAuth}
        />
        </div>
      </div>
    </header>
  );
}
