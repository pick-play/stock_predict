import { formatRelativeTime } from "../../lib/format";

interface MobileBottomBarProps {
  lastUpdated: string | null;
  isLoading: boolean;
}

export function MobileBottomBar({ lastUpdated, isLoading }: MobileBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-[#0d1118] border-t border-[rgba(255,255,255,0.07)] px-4 py-2.5 flex items-center justify-between">
      <span className="text-xs text-[#6f7a8c]">
        {isLoading
          ? "데이터 불러오는 중..."
          : lastUpdated
          ? `${formatRelativeTime(lastUpdated)} 갱신`
          : "대기 중"}
      </span>
      <span className="text-xs text-[#6f7a8c]">60초마다 자동 갱신</span>
    </div>
  );
}
