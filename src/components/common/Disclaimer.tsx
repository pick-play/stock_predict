import {
  BRAND_NAME,
  BRAND_NAME_HANGUL,
  BRAND_NAME_LATIN,
} from "../../config/brand";

interface DisclaimerProps {
  short?: boolean;
}

export function Disclaimer({ short = false }: DisclaimerProps) {
  if (short) {
    return (
      <p className="text-[13px] text-[var(--text-muted)] text-center px-4 leading-relaxed">
        해외 선물가격 기반 참고 예상가이며 실제 국내 체결가격과 다를 수
        있습니다.
      </p>
    );
  }

  return (
    <footer className="animate-slide-fade-in delay-450 rounded-2xl border border-[var(--border-mid)] bg-[var(--surface-overlay)] p-5">
      <div className="flex items-start gap-3">
        <div
          className="w-4 h-4 rounded-full border border-[var(--border-strong)] flex items-center justify-center flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <span className="text-[var(--text-tertiary)] text-[11px] font-bold leading-none">
            i
          </span>
        </div>
        <div>
          <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed mb-2">
            본 서비스의 예상가격은 해외 선물가격의 변동을 바탕으로 계산한
            참고정보이며, 한국거래소의 실제 체결가격이나 다음 거래일 시가를
            의미하지 않습니다. 상품의 유동성, 환율, 국내외 뉴스, 수급 및
            장전 동시호가 등에 따라 실제 가격과 차이가 발생할 수 있습니다.
            본 정보는 투자 권유 또는 매매 추천이 아닙니다.
          </p>
          <p className="text-[12px] text-[var(--text-muted)]">
            {/* All three spellings of the name, as body text. The header used
                to carry the Latin one; it now shows only the wordmark, and a
                search engine matches text it can find rather than a design. */}
            {BRAND_NAME}({BRAND_NAME_HANGUL}, {BRAND_NAME_LATIN}) · 해외 선물가격
            기반 코스피 야간 선물(야간선물·야선) 참고 서비스 · 야간, 주말 언제
            어디서나 삼성전자·SK하이닉스·현대차 등 국내 주요 종목의 예상가격을 확인하세요.
          </p>
          {/* Real paths, not hash routes: these are the standalone static info
              pages under public/ (about/guide/faq/privacy/terms), readable
              without the bundle. Plain <a> is correct — they leave the SPA. */}
          <nav
            aria-label="사이트 정보"
            className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px]"
          >
            <a className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline" href="/about/">서비스 소개</a>
            <a className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline" href="/guide/">이용 가이드</a>
            <a className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline" href="/faq/">자주 묻는 질문</a>
            <a className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline" href="/privacy/">개인정보처리방침</a>
            <a className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline" href="/terms/">이용약관</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
