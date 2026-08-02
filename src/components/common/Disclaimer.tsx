interface DisclaimerProps {
  short?: boolean;
}

export function Disclaimer({ short = false }: DisclaimerProps) {
  if (short) {
    return (
      <p className="text-[11px] text-[#4a5568] text-center px-4 leading-relaxed">
        바이낸스 연계상품 기반 참고 예상가이며 실제 국내 체결가격과 다를 수
        있습니다.
      </p>
    );
  }

  return (
    <footer className="animate-slide-fade-in delay-450 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-5">
      <div className="flex items-start gap-3">
        <div
          className="w-4 h-4 rounded-full border border-[rgba(255,255,255,0.15)] flex items-center justify-center flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <span className="text-[#6f7a8c] text-[9px] font-bold leading-none">
            i
          </span>
        </div>
        <div>
          <p className="text-[11px] text-[#6f7a8c] leading-relaxed mb-2">
            본 서비스의 예상가격은 바이낸스 연계상품의 가격 변동을 바탕으로
            계산한 참고정보이며, 한국거래소의 실제 체결가격이나 다음 거래일
            시가를 의미하지 않습니다. 상품의 유동성, 환율, 국내외 뉴스, 수급
            및 장전 동시호가 등에 따라 실제 가격과 차이가 발생할 수 있습니다.
            본 정보는 투자 권유 또는 매매 추천이 아닙니다.
          </p>
          <p className="text-[10px] text-[#4a5568]">
            야간 반도체 예상가 · 바이낸스 연계상품 기반 참고 서비스
          </p>
        </div>
      </div>
    </footer>
  );
}
