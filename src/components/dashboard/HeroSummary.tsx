import { isWeekend, isKrxTradingHours } from "../../lib/koreaMarket";

/**
 * The anchor basis and its date used to sit under the subtitle. Removed by owner
 * decision: every stock card already carries the same two facts next to the
 * price they explain ("최근 국내 종가 (08/10)" and "기준가 (08/10 종가)"), so the
 * line was a fourth heading row that only added height above the fold.
 */
export function HeroSummary() {
  const weekend = isWeekend();
  const trading = isKrxTradingHours();

  // Brand line stays constant; the session-specific notice below carries the
  // "market is open, trust the real ticks" warning instead of the headline.
  const titleLine1 = "코스피 나우";
  /*
   * Owner decision of 2026-08-11, replacing "코스피 현재가".
   *
   * Worth knowing what it claims: the site prices 삼성전자 and SK하이닉스 from
   * overseas futures. It does not quote the KOSPI 200 night future, which is what
   * a reader arriving on the words 야간 선물 is most likely looking for. The
   * disclaimer in §21 and the per-card 예상가 caption are what keep that honest,
   * so neither may be removed while this headline stands.
   */
  const titleLine2Accent = "해외 선물가격 기반 코스피 야간 선물";

  const subtitle = trading
    ? "본 예상가격보다 국내 실제 체결가격을 우선 확인하세요."
    : "야간, 주말 언제 어디서나 가격을 확인하세요.";

  const warning = trading
    ? "현재 한국거래소 정규장이 진행 중입니다. 실제 체결가 기준으로 거래하세요."
    : weekend
    ? "주말에는 거래량과 유동성이 낮아 예상가격의 변동성이 커질 수 있습니다."
    : null;

  return (
    <div className="animate-slide-fade-in px-4 md:px-6 py-5">
      <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] leading-snug tracking-tight">
        {titleLine1}
        <br />
        <span className="text-[#8b7cff]">{titleLine2Accent}</span>
      </h2>
      <p className="text-sm text-[var(--text-tertiary)] mt-2 leading-relaxed">{subtitle}</p>

      {warning && (
        <div
          className={`mt-3 inline-flex items-start gap-2 px-3 py-2 rounded-xl text-xs leading-relaxed ${
            trading
              ? "bg-[rgba(49,196,141,0.08)] text-[#31c48d] border border-[rgba(49,196,141,0.15)]"
              : "bg-[rgba(245,185,66,0.08)] text-[#f5b942] border border-[rgba(245,185,66,0.15)]"
          }`}
          role="alert"
        >
          <span aria-hidden="true" className="flex-shrink-0 mt-0.5">
            {trading ? "●" : "△"}
          </span>
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}
