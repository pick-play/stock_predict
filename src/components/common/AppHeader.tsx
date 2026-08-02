import { ConnectionBadge } from "./ConnectionBadge";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { formatRelativeTime } from "../../lib/format";

interface AppHeaderProps {
  isLoading: boolean;
  usingFallback: boolean;
  lastUpdated: string | null;
}

export function AppHeader({ isLoading, usingFallback, lastUpdated }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between py-4 px-4 md:px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#8b7cff] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">야</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-[#f4f7fb] leading-none">
            야간 반도체 예상가
          </h1>
          <p className="text-xs text-[#6f7a8c] mt-0.5">
            바이낸스 연계상품 기반
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MarketStatusBadge />
        <ConnectionBadge
          isLoading={isLoading}
          usingFallback={usingFallback}
          lastUpdated={lastUpdated}
        />
        {lastUpdated && !isLoading && (
          <span className="hidden md:block text-xs text-[#6f7a8c]">
            {formatRelativeTime(lastUpdated)}
          </span>
        )}
      </div>
    </header>
  );
}
