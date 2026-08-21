import { isWeekend } from "../../lib/koreaMarket";
import { useKrxSession } from "../../hooks/useKrxSession";

/**
 * The session notice, and nothing else.
 *
 * This used to open the page with the brand, the "해외 선물가격 기반 코스피 야간
 * 선물" headline and a subtitle. All three are gone (owner decision,
 * 2026-08-22): the header already says whose site this is, and on a phone those
 * lines pushed the prices — the reason anyone opened the page — below the fold.
 * The keyword text they carried now lives in the footer, where a search engine
 * reads it just as well and nobody has to scroll past it.
 *
 * What stays is the part that changes with the clock: the regular-hours warning
 * §13 requires (real fills come first while the exchange is open) and the
 * weekend liquidity note. When neither applies this renders nothing at all, and
 * the page runs from the header straight into the room and the cards.
 */
export function HeroSummary() {
  const weekend = isWeekend();
  // Observed, not predicted: on a holiday the calendar would tell a reader to
  // trust live fills from an exchange that is closed.
  const { trading } = useKrxSession();

  const warning = trading
    ? "현재 한국거래소 정규장이 진행 중입니다. 실제 체결가를 먼저 확인하세요."
    : weekend
      ? "주말에는 거래량과 유동성이 낮아 예상가격의 변동성이 커질 수 있습니다."
      : null;

  if (!warning) return null;

  return (
    <div
      className={`animate-slide-fade-in flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed ${
        trading
          ? "bg-[rgba(49,196,141,0.08)] text-[#31c48d] border border-[rgba(49,196,141,0.15)]"
          : "bg-[rgba(245,185,66,0.08)] text-[#f5b942] border border-[rgba(245,185,66,0.15)]"
      }`}
      role="alert"
    >
      <span aria-hidden="true" className="flex-shrink-0">
        {trading ? "●" : "△"}
      </span>
      <span>{warning}</span>
    </div>
  );
}
