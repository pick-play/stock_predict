import { ConnectionBadge } from "./ConnectionBadge";
import { ThemeToggle } from "./ThemeToggle";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { formatRelativeTime } from "../../lib/format";
import { useNow } from "../../hooks/useNow";
import type { WsConnectionStatus } from "../../lib/binance/websocketAdapter";

interface AppHeaderProps {
  isLoading: boolean;
  usingFallback: boolean;
  lastUpdated: string | null;
  wsStatus?: WsConnectionStatus;
  onNavigateBoard?: () => void;
}

export function AppHeader({
  isLoading,
  usingFallback,
  lastUpdated,
  wsStatus,
  onNavigateBoard,
}: AppHeaderProps) {
  const now = useNow();
  return (
    <header className="animate-fade-in flex items-center justify-between py-4 px-4 md:px-6 border-b border-[var(--border-mid)]">
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
            KOSPI NOW
          </h1>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wide">
            코스피 나우
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <MarketStatusBadge />
        <ConnectionBadge
          isLoading={isLoading}
          usingFallback={usingFallback}
          lastUpdated={lastUpdated}
          wsStatus={wsStatus}
        />
        {lastUpdated && !isLoading && (
          <span className="hidden md:block text-[10px] text-[var(--text-muted)] tabular-nums">
            {formatRelativeTime(lastUpdated, now)}
          </span>
        )}
        {onNavigateBoard && (
          <button
            type="button"
            onClick={onNavigateBoard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            aria-label="익명 토론방 열기"
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
            <span className="hidden sm:inline">토론방</span>
          </button>
        )}
      </div>
    </header>
  );
}
