/**
 * Upcoming US releases: the four soonest, expanding to the month on request.
 *
 * There is no consensus column and there will not be one. The agencies do not
 * forecast their own releases, so an expectation would have to be bought from a
 * vendor or invented — and an invented number beside a real date is exactly the
 * false certainty §10 rules out. A date and, once published, the figure itself.
 */

import { useState } from "react";
import { useEconomicCalendar } from "../../hooks/useEconomicCalendar";
import { upcomingReleases, pastReleases } from "../../lib/economic/api";
import {
  formatReleaseWhen,
  formatReleaseWhenLong,
  formatCountdown,
  isToday,
} from "../../lib/economic/format";
import { useNow } from "../../hooks/useNow";
import {
  ECONOMIC_PREVIEW_COUNT,
  ECONOMIC_WINDOW_DAYS,
} from "../../config/economic";
import type { EconomicRelease } from "../../types/economic";

function ReleaseRow({
  release,
  nowMs,
  published,
}: {
  release: EconomicRelease;
  nowMs: number;
  published?: boolean;
}) {
  const today = !published && isToday(release.releaseAtUtc, nowMs);

  return (
    <li
      className="flex items-baseline gap-2 py-1"
      title={formatReleaseWhenLong(release.releaseAtUtc)}
    >
      <time
        dateTime={release.releaseAtUtc}
        className={`shrink-0 tabular-nums text-[13px] ${
          today
            ? "font-semibold text-[#8b7cff]"
            : published
            ? "text-[var(--text-muted)]"
            : "text-[var(--text-tertiary)]"
        }`}
      >
        {formatReleaseWhen(release.releaseAtUtc)}
      </time>

      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          published
            ? "text-[var(--text-tertiary)]"
            : "text-[var(--text-primary)]"
        }`}
      >
        {release.label}
      </span>

      <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
        {release.source}
      </span>

      <span
        className={`shrink-0 tabular-nums text-[12px] ${
          today ? "text-[#8b7cff]" : "text-[var(--text-muted)]"
        }`}
      >
        {published ? "발표됨" : formatCountdown(release.releaseAtUtc, nowMs)}
      </span>
    </li>
  );
}

export function EconomicCalendar() {
  const { calendar } = useEconomicCalendar();
  const [expanded, setExpanded] = useState(false);
  const now = useNow(60_000);
  const nowMs = now.getTime();

  // Hidden entirely when the file is missing, malformed, or unmaintained — see
  // fetchEconomicCalendar, which refuses a snapshot nobody has updated in days.
  if (!calendar) return null;

  const upcoming = upcomingReleases(calendar, nowMs);
  if (upcoming.length === 0) return null;

  const preview = upcoming.slice(0, ECONOMIC_PREVIEW_COUNT);
  const past = expanded ? pastReleases(calendar, nowMs) : [];

  return (
    <section
      className="animate-fade-in rounded-2xl border border-[var(--border-subtle)] bg-surface-1 px-4 py-3"
      aria-label="미국 주요 지표 발표 일정"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)]">
          미국 주요 지표
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          /* The before: halo lifts the hit box to §19's 44px while the visible
             control keeps its 36px row — the PILL_QUIET trade from controls.ts,
             kept invisible so the panel header does not grow. */
          className="min-h-[36px] relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] rounded-lg px-2 text-[13px] text-[var(--text-tertiary)] transition-colors duration-150 hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
        >
          {expanded ? "접기" : "전체보기"}
        </button>
      </div>

      <ol className="divide-y divide-[var(--border-subtle)]">
        {(expanded ? upcoming : preview).map((release) => (
          <ReleaseRow
            key={`${release.id}-${release.date}`}
            release={release}
            nowMs={nowMs}
          />
        ))}
      </ol>

      {expanded && past.length > 0 && (
        <>
          <p className="mt-3 mb-1 text-[12px] font-semibold text-[var(--text-muted)]">
            지난 발표
          </p>
          <ol className="divide-y divide-[var(--border-subtle)]">
            {past.map((release) => (
              <ReleaseRow
                key={`${release.id}-${release.date}`}
                release={release}
                nowMs={nowMs}
                published
              />
            ))}
          </ol>
        </>
      )}

      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
        {expanded
          ? `향후 ${ECONOMIC_WINDOW_DAYS}일 일정 · 한국시간 · 출처 FRED`
          : "한국시간 기준 · 출처 FRED"}
        {" · "}
        시장 예상치는 제공하지 않습니다
      </p>
    </section>
  );
}
