interface DisclaimerProps {
  short?: boolean;
}

export function Disclaimer({ short = false }: DisclaimerProps) {
  if (short) {
    return (
      <p className="text-xs text-[#6f7a8c] text-center px-4">
        바이낸스 연계상품 기반 참고 예상가이며 실제 국내 체결가격과 다를 수 있습니다.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0d1118] p-4">
      <p className="text-xs text-[#6f7a8c] leading-relaxed">
        본 서비스의 예상가격은 바이낸스 연계상품의 가격 변동을 바탕으로 계산한 참고정보이며,
        한국거래소의 실제 체결가격이나 다음 거래일 시가를 의미하지 않습니다.
        상품의 유동성, 환율, 국내외 뉴스, 수급 및 장전 동시호가 등에 따라 실제 가격과
        차이가 발생할 수 있습니다. 본 정보는 투자 권유 또는 매매 추천이 아닙니다.
      </p>
    </div>
  );
}
