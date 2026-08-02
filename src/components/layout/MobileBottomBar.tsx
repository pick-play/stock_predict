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
      className="fixed bottom-0 left-0 right-0 md:hidden border-t border-[var(--border-subtle)] px-4 py-2.5 flex items-center justify-between"
      style={{
        background: "color-mix(in srgb, var(--surface-1) 92%, transparent)",
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
            <span className="text-xs text-[var(--text-tertiary)]">불러오는 중…</span>
          </>
        ) : lastUpdated ? (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#31c48d]"
              aria-hidden="true"
            />
            <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
              {formatRelativeTime(lastUpdated)} 갱신
            </span>
          </>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">대기 중</span>
        )}
      </div>
      <span className="text-[10px] text-[var(--text-muted)]">60초 자동 갱신</span>
    </div>
  );
}
