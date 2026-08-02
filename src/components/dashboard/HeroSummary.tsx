import { isWeekend, isKrxTradingHours } from "../../lib/koreaMarket";

export function HeroSummary() {
  const weekend = isWeekend();
  const trading = isKrxTradingHours();

  const titleLine1 = trading
    ? "현재 한국거래소"
    : weekend
    ? "주말 바이낸스 연계상품"
    : "오늘 밤 시장이 반영한";

  const titleLine2Accent = trading
    ? "정규장 진행 중"
    : weekend
    ? "한국 반도체 참고가격"
    : "한국 반도체 예상가격";

  const subtitle = trading
    ? "본 예상가격보다 국내 실제 체결가격을 우선 확인하세요."
    : "바이낸스 연계상품 가격 변동 기반 야간 참고 예상가입니다.";

  const warning = trading
    ? "현재 한국거래소 정규장이 진행 중입니다. 실제 체결가 기준으로 거래하세요."
    : weekend
    ? "주말에는 거래량과 유동성이 낮아 예상가격의 변동성이 커질 수 있습니다."
    : null;

  return (
    <div className="animate-slide-fade-in px-4 md:px-6 py-5">
      <h2 className="text-xl md:text-2xl font-bold text-[#f4f7fb] leading-snug tracking-tight">
        {titleLine1}
        <br />
        <span className="text-[#8b7cff]">{titleLine2Accent}</span>
      </h2>
      <p className="text-sm text-[#6f7a8c] mt-2 leading-relaxed">{subtitle}</p>

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
