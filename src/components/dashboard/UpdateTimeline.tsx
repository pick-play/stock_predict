import { formatKoreanTime } from "../../lib/format";

interface UpdateTimelineProps {
  lastUpdated: string | null;
  nextRefreshAt?: string | null;
}

export function UpdateTimeline({ lastUpdated, nextRefreshAt }: UpdateTimelineProps) {
  return (
    <div className="flex items-center gap-4 text-xs text-[#6f7a8c] px-1">
      {lastUpdated && (
        <span>마지막 갱신: {formatKoreanTime(lastUpdated)}</span>
      )}
      {nextRefreshAt && (
        <span>다음 갱신 예정: {formatKoreanTime(nextRefreshAt)}</span>
      )}
    </div>
  );
}
