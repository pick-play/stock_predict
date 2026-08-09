import type { WsConnectionStatus } from "../../lib/binance/websocketAdapter";

interface ConnectionBadgeProps {
  usingFallback: boolean;
  isLoading: boolean;
  lastUpdated: string | null;
  wsStatus?: WsConnectionStatus;
}

export function ConnectionBadge({
  usingFallback,
  isLoading,
  lastUpdated,
  wsStatus,
}: ConnectionBadgeProps) {
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-3 text-[#a6b0c0]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f5b942] animate-pulse" />
        연결 중
      </span>
    );
  }

  if (usingFallback) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-3 text-[#f5b942]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f5b942]" />
        저장 데이터
      </span>
    );
  }

  if (lastUpdated) {
    // Pulse the dot when WS is actively streaming; static when REST-only.
    const wsLive = wsStatus === "connected";
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-3 text-[#31c48d]">
        <span
          className={`w-1.5 h-1.5 rounded-full bg-[#31c48d]${wsLive ? " animate-pulse" : ""}`}
        />
        실시간
      </span>
    );
  }

  return null;
}
