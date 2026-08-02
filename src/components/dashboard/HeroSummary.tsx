import { isWeekend, isKrxTradingHours } from "../../lib/koreaMarket";

export function HeroSummary() {
  const weekend = isWeekend();
  const trading = isKrxTradingHours();

  let subtitle = "바이낸스 연계상품 가격 변동 기반 야간 참고 예상가입니다.";
  let warning: string | null = null;

  if (trading) {
    subtitle = "현재 한국거래소 정규장이 진행 중입니다.";
    warning = "본 예상가격보다 국내 실제 체결가격을 우선 확인하세요.";
  } else if (weekend) {
    warning = "주말에는 거래량과 유동성이 낮아 예상가격의 변동성이 커질 수 있습니다.";
  }

  return (
    <div className="px-4 md:px-6 py-4">
      <h2 className="text-xl md:text-2xl font-bold text-[#f4f7fb] leading-snug">
        오늘 밤 시장이 반영한
        <br />
        <span className="text-[#8b7cff]">한국 반도체 예상가격</span>
      </h2>
      <p className="text-sm text-[#a6b0c0] mt-2">{subtitle}</p>
      {warning && (
        <p className="text-xs text-[#f5b942] mt-1.5 bg-[rgba(245,185,66,0.08)] px-3 py-2 rounded-lg">
          {warning}
        </p>
      )}
    </div>
  );
}
