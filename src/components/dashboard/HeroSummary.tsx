import { useKrxSession } from "../../hooks/useKrxSession";

/**
 * The regular-hours notice, and nothing else.
 *
 * This used to open the page with the brand, the "해외 선물가격 기반 코스피 야간
 * 선물" headline and a subtitle. All three are gone (owner decision,
 * 2026-08-22): the header already says whose site this is, and on a phone those
 * lines pushed the prices — the reason anyone opened the page — below the fold.
 * The keyword text they carried now lives in the footer, where a search engine
 * reads it just as well and nobody has to scroll past it.
 *
 * What stays is the one notice that changes what a reader should do: while the
 * exchange is open, real fills come first (§13). Any other time this renders
 * nothing at all and the page runs from the header straight into the cards.
 *
 * The weekend liquidity note is gone too (owner decision, 2026-08-22). It was
 * true and it was permanent — a banner that is up for two days out of seven,
 * saying the same thing every week, is furniture rather than a warning, and it
 * pushed the prices down the page on a phone for the whole weekend. §21's
 * disclaimer still says the estimate is not a domestic fill, every hour of the
 * week.
 */
export function HeroSummary() {
  // Observed, not predicted: on a holiday the calendar would tell a reader to
  // trust live fills from an exchange that is closed.
  const { trading } = useKrxSession();

  if (!trading) return null;

  return (
    <div
      className="animate-slide-fade-in flex items-start gap-2 rounded-xl border border-[rgba(49,196,141,0.15)] bg-[rgba(49,196,141,0.08)] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-[#31c48d]"
      role="alert"
    >
      <span aria-hidden="true" className="flex-shrink-0">
        ●
      </span>
      <span>
        현재 한국거래소 정규장이 진행 중입니다. 실제 체결가를 먼저 확인하세요.
      </span>
    </div>
  );
}
