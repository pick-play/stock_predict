import { ConnectionBadge } from "./ConnectionBadge";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { formatRelativeTime } from "../../lib/format";

interface AppHeaderProps {
  isLoading: boolean;
  usingFallback: boolean;
  lastUpdated: string | null;
}

export function AppHeader({
  isLoading,
  usingFallback,
  lastUpdated,
}: AppHeaderProps) {
  return (
    <header className="animate-fade-in flex items-center justify-between py-4 px-4 md:px-6 border-b border-[var(--border-mid)]">
      {/* Logo mark */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)",
          }}
          aria-hidden="true"
        >
          <span className="text-white text-xs font-bold tracking-tight">
            야간
          </span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-none tracking-tight">
            야간 반도체 예상가
          </h1>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wide">
            해외 선물가격 기반
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <MarketStatusBadge />
        <ConnectionBadge
          isLoading={isLoading}
          usingFallback={usingFallback}
          lastUpdated={lastUpdated}
        />
        {lastUpdated && !isLoading && (
          <span className="hidden md:block text-[10px] text-[var(--text-muted)] tabular-nums">
            {formatRelativeTime(lastUpdated)}
          </span>
        )}
      </div>
    </header>
  );
}
