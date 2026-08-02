import { formatRelativeTime } from "../../lib/format";

interface MobileBottomBarProps {
  lastUpdated: string | null;
  isLoading: boolean;
}

export function MobileBottomBar({
  lastUpdated,
  isLoading,
}: MobileBottomBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:hidden border-t border-[rgba(255,255,255,0.06)] px-4 py-2.5 flex items-center justify-between"
      style={{
        background: "rgba(13, 17, 24, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      aria-live="polite"
      aria-label="갱신 상태"
    >
      <div className="flex items-center gap-2">
        {isLoading ? (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#f5b942] animate-pulse"
              aria-hidden="true"
            />
            <span className="text-xs text-[#6f7a8c]">불러오는 중…</span>
          </>
        ) : lastUpdated ? (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#31c48d]"
              aria-hidden="true"
            />
            <span className="text-xs text-[#6f7a8c] tabular-nums">
              {formatRelativeTime(lastUpdated)} 갱신
            </span>
          </>
        ) : (
          <span className="text-xs text-[#4a5568]">대기 중</span>
        )}
      </div>
      <span className="text-[10px] text-[#4a5568]">60초 자동 갱신</span>
    </div>
  );
}
