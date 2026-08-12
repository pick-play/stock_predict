# CLAUDE.md

## 1. 프로젝트 개요

이 프로젝트는 바이낸스에서 거래되는 삼성전자 및 SK하이닉스 연계 상품의 가격을 이용하여, 한국거래소가 닫힌 저녁·새벽·주말에도 두 종목의 참고용 예상 원화 가격을 보여주는 정적 웹사이트다.

서비스의 핵심 목적은 다음과 같다.

1. 삼성전자와 SK하이닉스의 바이낸스 연계 가격을 주기적으로 수집한다.
2. 국내 주식시장 직전 종가와 바이낸스 기준가격을 비교한다.
3. 바이낸스 가격의 변동률을 국내 종가에 반영한다.
4. 계산된 원화 예상가격을 한국거래소 호가단위에 맞게 반올림한다.
5. 모바일과 데스크톱 모두에서 보기 좋은 고급 금융 대시보드 UI로 표시한다.
6. 별도 개인 서버나 개인 컴퓨터 없이 GitHub Pages와 GitHub Actions만으로 운영한다.
7. 사용자 브라우저에서는 1분마다 최신 데이터를 갱신한다.
8. GitHub Actions에서는 지원 가능한 최소 주기인 5분마다 이력 데이터를 저장한다.

이 서비스는 실제 한국거래소 체결가격이나 공식 장외가격을 제공하는 서비스가 아니다. 모든 화면에서 다음 표현을 사용한다.

* 야간 예상가격
* 참고가격
* 바이낸스 연계상품 기반 예상치
* 다음 거래일 참고 예상가

다음 표현은 사용하지 않는다.

* 실시간 삼성전자 주가
* 실시간 SK하이닉스 주가
* 확정 개장가
* 보장된 예상가
* 매수·매도 추천
* 반드시 상승 또는 반드시 하락

---

## 2. 절대적인 개발 원칙

Claude는 이 프로젝트를 수정할 때 다음 원칙을 반드시 지킨다.

### 2.1 작업 방식

* 기존 파일 구조를 먼저 확인한 후 수정한다.
* 이미 구현된 기능을 불필요하게 다시 작성하지 않는다.
* 한 번에 지나치게 많은 파일을 변경하지 않는다.
* 타입 오류, 린트 오류, 빌드 오류를 남기지 않는다.
* 구현 후 반드시 테스트와 빌드를 실행한다.
* 오류를 임시로 숨기기 위해 `any`, `@ts-ignore`, 빈 `catch`를 남용하지 않는다.
* API 응답 구조를 추측하여 하드코딩하지 않는다.
* 실제 응답이 예상과 다를 때 안전하게 실패하도록 작성한다.
* 심볼, API URL, 기준 종가 등 변경 가능성이 있는 값은 설정 파일로 분리한다.
* 사용자에게 표시되는 모든 시간은 `Asia/Seoul` 기준으로 처리한다.
* 내부 저장 시간은 ISO 8601 UTC 형식을 기본으로 사용한다.
* 금액 계산에는 부동소수점 오류를 고려한다.
* 호가단위 반올림에는 JavaScript 기본 `Math.round()`만 무비판적으로 사용하지 않는다.
* 금융 데이터가 오래되었을 경우 정상 데이터처럼 표시하지 않는다.

### 2.2 금지 사항

* 개인 API 키를 프론트엔드 코드에 넣지 않는다.
* `.env` 파일을 Git에 커밋하지 않는다.
* 브라우저에서 비밀키가 필요한 API를 호출하지 않는다.
* Binance 사용자 계정 정보나 주문 API를 사용하지 않는다.
* 매매, 주문, 포지션 진입 기능을 구현하지 않는다.
* 자동매매 기능을 추가하지 않는다.
* 수익을 보장하는 문구를 작성하지 않는다.
* 바이낸스 가격을 원달러 환율만 곱해 국내 주식 가격으로 직접 간주하지 않는다.
* 국내 종가와 바이낸스 상품의 기준가격 시점을 맞추지 않은 상태에서 예상가격을 계산하지 않는다.
* GitHub Actions를 1분 cron으로 설정하지 않는다.
* 불가능한 1분 GitHub Actions 실행을 가능한 것처럼 설명하지 않는다.

---

## 3. 기술 스택

기본 기술 스택은 다음과 같다.

### 프론트엔드

* React
* TypeScript
* Vite
* Tailwind CSS
* Recharts 또는 Lightweight Charts
* Lucide React
* date-fns
* Zod

### 배포

* GitHub Pages
* GitHub Actions

### 데이터 저장

* `public/data/latest.json`
* `public/data/history.json`
* 필요 시 날짜별 `public/data/history/YYYY-MM-DD.json`

### 테스트

* Vitest
* React Testing Library
* Playwright는 선택 사항

### 패키지 관리자

* `npm`을 기본으로 사용한다.
* 저장소에 `package-lock.json`이 있으면 npm만 사용한다.
* 기존에 pnpm 또는 yarn이 설정되어 있다면 기존 설정을 유지한다.

---

## 4. 권장 프로젝트 구조

```text
.
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml
│       └── update-market-data.yml
├── public/
│   └── data/
│       ├── latest.json
│       ├── history.json
│       └── baseline.json
├── scripts/
│   ├── fetch-market-data.mjs
│   ├── update-history.mjs
│   └── validate-data.mjs
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppHeader.tsx
│   │   │   ├── ConnectionBadge.tsx
│   │   │   ├── Disclaimer.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   └── MarketStatusBadge.tsx
│   │   ├── dashboard/
│   │   │   ├── HeroSummary.tsx
│   │   │   ├── StockEstimateCard.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   ├── MarketMetrics.tsx
│   │   │   ├── PriceBreakdown.tsx
│   │   │   └── UpdateTimeline.tsx
│   │   └── layout/
│   │       ├── DashboardLayout.tsx
│   │       └── MobileBottomBar.tsx
│   ├── config/
│   │   ├── market.ts
│   │   ├── symbols.ts
│   │   └── theme.ts
│   ├── hooks/
│   │   ├── useMarketData.ts
│   │   ├── useMinuteRefresh.ts
│   │   └── usePageVisibility.ts
│   ├── lib/
│   │   ├── binance/
│   │   │   ├── client.ts
│   │   │   ├── normalizer.ts
│   │   │   ├── restAdapter.ts
│   │   │   ├── tradFiAdapter.ts
│   │   │   ├── types.ts
│   │   │   └── websocketAdapter.ts
│   │   ├── calculateEstimate.ts
│   │   ├── format.ts
│   │   ├── koreaMarket.ts
│   │   ├── roundToKrxTick.ts
│   │   ├── staleData.ts
│   │   └── validation.ts
│   ├── pages/
│   │   └── DashboardPage.tsx
│   ├── types/
│   │   └── market.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── CLAUDE.md
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

프로젝트가 Next.js로 이미 만들어져 있다면 Vite로 강제 변경하지 않는다. 기존 프레임워크를 유지하면서 동일한 기능과 구조를 적용한다.

---

## 5. 서비스 동작 구조

사이트는 다음 두 종류의 업데이트를 구분한다.

### 5.1 브라우저 실시간 표시

사용자가 사이트를 열면 브라우저에서 바이낸스 공개 시장 데이터에 접근한다.

기본 화면 갱신 주기는 60초다.

```text
사용자 브라우저
    ↓
바이낸스 공개 시세 API 또는 WebSocket
    ↓
가격 정규화
    ↓
국내 기준 종가 대비 예상가격 계산
    ↓
한국거래소 호가단위 반올림
    ↓
화면 갱신
```

다음 조건을 적용한다.

* 최초 접속 시 즉시 1회 데이터를 요청한다.
* 이후 60초 간격으로 다시 계산한다.
* 탭이 백그라운드로 이동하면 불필요한 반복 요청을 줄인다.
* 탭이 다시 활성화되면 즉시 최신 데이터를 요청한다.
* 네트워크 오류 시 직전 정상 데이터를 유지한다.
* 오류가 난 가격을 0으로 덮어쓰지 않는다.
* 마지막 정상 업데이트 시간을 명확하게 표시한다.
* 오래된 데이터는 `지연` 또는 `업데이트 중단` 상태로 표시한다.
* 동일 요청이 중복 실행되지 않도록 요청 잠금 또는 AbortController를 사용한다.

### 5.2 GitHub Actions 이력 저장

GitHub Actions는 5분 간격으로 실행한다.

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "2-57/5 * * * *"
```

정각에 실행 요청이 몰릴 수 있으므로 `*/5` 대신 약간 비껴간 분을 사용하는 것을 우선 고려한다.

GitHub Actions가 실행할 작업:

1. 저장소 체크아웃
2. Node.js 설치
3. 의존성 설치
4. 바이낸스 데이터 조회
5. 응답 검증
6. 예상가격 계산
7. `latest.json` 갱신
8. `history.json`에 신규 레코드 추가
9. 중복 타임스탬프 제거
10. 저장 한도에 따라 오래된 초단기 데이터 정리
11. 변경사항이 있을 때만 자동 커밋
12. GitHub Pages 재배포 또는 정적 파일 갱신

GitHub Actions의 데이터는 브라우저 실시간 데이터가 실패할 때 폴백 데이터로 사용한다.

---

## 6. 데이터 소스 처리 원칙

### 6.1 바이낸스 데이터

삼성전자 및 SK하이닉스 연계상품 심볼은 코드 전체에 직접 반복해서 쓰지 않는다.

```ts
export const MARKET_SYMBOLS = {
  samsung: {
    id: "samsung",
    displayName: "삼성전자",
    koreanTicker: "005930",
    binanceSymbol: "SAMSUNGUSDT",
  },
  skHynix: {
    id: "sk-hynix",
    displayName: "SK하이닉스",
    koreanTicker: "000660",
    binanceSymbol: "SKHYNIXUSDT",
  },
} as const;
```

실제 바이낸스 심볼은 출시 상태와 API 응답을 통해 검증해야 한다.

심볼이 조회되지 않을 경우:

* 앱 전체를 중단하지 않는다.
* 해당 종목만 `데이터 확인 중` 상태로 표시한다.
* 다른 종목은 정상 표시한다.
* 콘솔에는 구조화된 오류를 남긴다.
* 사용자 화면에는 과도하게 기술적인 오류 메시지를 노출하지 않는다.

### 6.2 TradFi 상품 분리

바이낸스의 일반 USDT-M 상품과 TradFi 연계상품은 동일한 응답 경로 또는 메시지 구조라고 가정하지 않는다.

다음 인터페이스로 추상화한다.

```ts
export interface MarketDataProvider {
  fetchQuote(symbol: string): Promise<NormalizedQuote>;
  fetchMarkPrice?(symbol: string): Promise<NormalizedQuote>;
  connectStream?(
    symbols: string[],
    onQuote: (quote: NormalizedQuote) => void
  ): () => void;
}
```

`tradFiAdapter.ts`가 원본 응답을 앱 공통 타입으로 변환한다.

```ts
export interface NormalizedQuote {
  symbol: string;
  lastPrice: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  volume24h: number | null;
  changePercent24h: number | null;
  fundingRate: number | null;
  eventTime: string;
  source: "binance-rest" | "binance-websocket" | "github-snapshot";
}
```

계산용 우선순위:

1. 유효한 Mark Price
2. 유효한 Bid·Ask 중간값
3. 유효한 Last Price
4. GitHub에 저장된 최근 정상가격

단, 상품 특성 확인 결과 Last Price를 기준으로 써야 더 적합하다면 설정에서 변경할 수 있도록 한다.

```ts
export type ReferencePriceMode =
  | "mark"
  | "mid"
  | "last";
```

---

## 7. 국내 기준가격 관리

예상가격 계산에는 다음 두 값이 필요하다.

1. 최근 한국거래소 종가
2. 같은 기준시점의 바이낸스 가격

이를 `baseline.json`으로 관리한다.

```json
{
  "marketDate": "2026-08-01",
  "capturedAt": "2026-08-01T06:31:00.000Z",
  "timezone": "Asia/Seoul",
  "stocks": {
    "samsung": {
      "krxClose": 0,
      "binanceReferencePrice": 0,
      "referencePriceMode": "mark"
    },
    "skHynix": {
      "krxClose": 0,
      "binanceReferencePrice": 0,
      "referencePriceMode": "mark"
    }
  }
}
```

초기 개발 단계에서는 국내 종가를 수동으로 입력할 수 있다.

단, 다음 검증을 반드시 수행한다.

* `krxClose > 0`
* `binanceReferencePrice > 0`
* 기준일이 미래가 아님
* 삼성전자와 SK하이닉스 기준일이 동일함
* 기준가격이 지나치게 오래된 경우 경고 표시
* 새로운 국내 거래일이 시작되었는데 기준가격이 갱신되지 않으면 `기준가격 갱신 필요` 표시

국내 종가 자동 수집 기능은 데이터 제공 조건과 라이선스를 확인한 뒤 별도 모듈로 추가한다.

---

## 8. 예상가격 계산식

기본 계산은 절대가격 환산이 아니라 국내장 마감 이후 바이낸스 상품의 상대수익률을 이용한다.

### 8.1 기본 변동률

```text
야간 변동률
= 현재 바이낸스 기준가격 / 국내장 마감시 바이낸스 기준가격 - 1
```

### 8.2 예상 국내가격

```text
반올림 전 예상가격
= 최근 국내 종가 × (1 + 야간 변동률)
```

동일식:

```text
반올림 전 예상가격
= 최근 국내 종가
× 현재 바이낸스 기준가격
÷ 국내장 마감시 바이낸스 기준가격
```

TypeScript 구현:

```ts
export interface EstimateInput {
  krxClose: number;
  currentBinancePrice: number;
  baselineBinancePrice: number;
}

export interface EstimateResult {
  rawEstimatedPrice: number;
  estimatedPrice: number;
  changeRate: number;
  changeAmount: number;
}

export function calculateEstimate(
  input: EstimateInput
): EstimateResult {
  const {
    krxClose,
    currentBinancePrice,
    baselineBinancePrice,
  } = input;

  if (
    !Number.isFinite(krxClose) ||
    !Number.isFinite(currentBinancePrice) ||
    !Number.isFinite(baselineBinancePrice) ||
    krxClose <= 0 ||
    currentBinancePrice <= 0 ||
    baselineBinancePrice <= 0
  ) {
    throw new Error("Invalid estimate input");
  }

  const changeRate =
    currentBinancePrice / baselineBinancePrice - 1;

  const rawEstimatedPrice =
    krxClose * (1 + changeRate);

  const estimatedPrice =
    roundToKrxTick(rawEstimatedPrice);

  return {
    rawEstimatedPrice,
    estimatedPrice,
    changeRate,
    changeAmount: estimatedPrice - krxClose,
  };
}
```

### 8.3 이상치 제한

가격 오류로 비정상적인 예상치가 표시되지 않도록 방어한다.

기본 제한:

* 단일 업데이트에서 ±30%를 초과하는 변동은 바로 정상값으로 반영하지 않는다.
* 가격이 이전 값의 0.5배 미만 또는 2배 초과이면 이상치로 본다.
* Bid가 Ask보다 크면 해당 호가 데이터는 사용하지 않는다.
* 스프레드가 설정한 허용 기준보다 크면 신뢰도를 낮춘다.
* 24시간 거래량이 극단적으로 낮으면 경고를 표시한다.
* 원본 데이터가 5분 이상 갱신되지 않으면 `지연` 상태로 표시한다.
* 15분 이상 갱신되지 않으면 예상가격의 강조도를 낮추고 경고를 표시한다.

이상치 발생 시 직전 정상값을 유지하되, 화면에 데이터 상태를 표시한다.

---

## 9. 한국거래소 호가단위 반올림

예상가격은 반드시 한국 주식 호가단위에 맞게 반올림한다.

호가단위:

| 주가 구간                   |   호가단위 |
| ----------------------- | -----: |
| 1,000원 미만               |     1원 |
| 1,000원 이상 5,000원 미만     |     5원 |
| 5,000원 이상 10,000원 미만    |    10원 |
| 10,000원 이상 50,000원 미만   |    50원 |
| 50,000원 이상 100,000원 미만  |   100원 |
| 100,000원 이상 500,000원 미만 |   500원 |
| 500,000원 이상             | 1,000원 |

현재 프로젝트 대상은 유가증권시장 상장 종목인 삼성전자와 SK하이닉스다.

### 9.1 반올림 규칙

* 가장 가까운 호가단위로 반올림한다.
* 정확히 절반이면 위쪽 호가로 반올림한다.
* JavaScript의 부동소수점 오차를 고려한다.
* 음수, NaN, Infinity는 허용하지 않는다.
* 가격 구간 경계에서 반올림 후 호가단위가 달라질 수 있으므로 결과를 재검증한다.

권장 구현:

```ts
export function getKrxTickSize(price: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite non-negative number");
  }

  if (price < 1_000) return 1;
  if (price < 5_000) return 5;
  if (price < 10_000) return 10;
  if (price < 50_000) return 50;
  if (price < 100_000) return 100;
  if (price < 500_000) return 500;

  return 1_000;
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + Number.EPSILON);
}

export function roundToKrxTick(price: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite non-negative number");
  }

  let tick = getKrxTickSize(price);
  let rounded = roundHalfUp(price / tick) * tick;

  const adjustedTick = getKrxTickSize(rounded);

  if (adjustedTick !== tick) {
    tick = adjustedTick;
    rounded = roundHalfUp(price / tick) * tick;
  }

  return rounded;
}
```

### 9.2 테스트 케이스

다음 테스트를 반드시 작성한다.

```ts
describe("roundToKrxTick", () => {
  it("1,000원 미만은 1원 단위로 반올림한다", () => {
    expect(roundToKrxTick(999.4)).toBe(999);
    expect(roundToKrxTick(999.5)).toBe(1_000);
  });

  it("1,000원 이상 5,000원 미만은 5원 단위다", () => {
    expect(roundToKrxTick(1_002)).toBe(1_000);
    expect(roundToKrxTick(1_002.5)).toBe(1_005);
  });

  it("5,000원 이상 10,000원 미만은 10원 단위다", () => {
    expect(roundToKrxTick(7_124)).toBe(7_120);
    expect(roundToKrxTick(7_125)).toBe(7_130);
  });

  it("10,000원 이상 50,000원 미만은 50원 단위다", () => {
    expect(roundToKrxTick(32_424)).toBe(32_400);
    expect(roundToKrxTick(32_425)).toBe(32_450);
  });

  it("50,000원 이상 100,000원 미만은 100원 단위다", () => {
    expect(roundToKrxTick(72_149)).toBe(72_100);
    expect(roundToKrxTick(72_150)).toBe(72_200);
  });

  it("100,000원 이상 500,000원 미만은 500원 단위다", () => {
    expect(roundToKrxTick(187_249)).toBe(187_000);
    expect(roundToKrxTick(187_250)).toBe(187_500);
  });

  it("500,000원 이상은 1,000원 단위다", () => {
    expect(roundToKrxTick(500_499)).toBe(500_000);
    expect(roundToKrxTick(500_500)).toBe(501_000);
  });

  it("잘못된 값을 거부한다", () => {
    expect(() => roundToKrxTick(-1)).toThrow();
    expect(() => roundToKrxTick(Number.NaN)).toThrow();
    expect(() => roundToKrxTick(Number.POSITIVE_INFINITY)).toThrow();
  });
});
```

---

## 10. 신뢰도 점수

예상가격 옆에 0~100 범위의 참고 신뢰도를 표시한다.

신뢰도는 예측 정확도를 보장하는 값이 아니라 데이터 상태를 나타내는 품질 점수다.

예시 구성:

```text
기본점수                         100점
데이터 1분 이상 지연             -10점
데이터 5분 이상 지연             -30점
호가 스프레드 확대               -10점
거래량 부족                      -15점
Mark Price 부재                  -10점
기준가격 1거래일 이상 미갱신      -25점
주말 또는 국내 휴장기간           -10점
직전 정상값 폴백 사용             -20점
```

점수 구간:

* 80~100: 데이터 양호
* 60~79: 참고 가능
* 40~59: 변동성 주의
* 0~39: 신뢰도 낮음

UI에서 신뢰도는 지나치게 확정적인 확률처럼 보이지 않도록 한다.

잘못된 예:

```text
상승 확률 87%
```

권장 표현:

```text
데이터 신뢰도 87/100
현재 데이터 상태 양호
```

실제 상승확률 모델이 별도로 검증되지 않은 상태에서는 상승확률을 표시하지 않는다.

---

## 11. UI 및 디자인 시스템

UI는 일반적인 관리자 페이지가 아니라, 고급 증권·핀테크 앱 수준으로 제작한다.

### 11.1 전체 방향

디자인 키워드:

* Premium
* Modern Korean Fintech
* Calm
* Data-focused
* High contrast
* Minimal
* Trustworthy
* Mobile-first
* Refined motion
* Dark financial dashboard

피해야 할 디자인:

* 과도한 네온 효과
* 카지노 같은 분위기
* 지나치게 많은 빨강과 파랑
* 모든 카드에 강한 그림자
* 무의미한 그라데이션 남용
* 한 화면에 너무 많은 숫자
* 작은 글씨
* 데스크톱 전용 레이아웃
* 주식 상승·하락 색상 외의 의미 없는 색상 사용

### 11.2 색상

기본은 다크 모드다.

```css
:root {
  --background: #080b10;
  --surface-1: #0d1118;
  --surface-2: #121824;
  --surface-3: #18202e;

  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-strong: rgba(255, 255, 255, 0.13);

  --text-primary: #f4f7fb;
  --text-secondary: #a6b0c0;
  --text-tertiary: #6f7a8c;

  --rise: #ff4d5e;
  --rise-soft: rgba(255, 77, 94, 0.14);

  --fall: #3f82ff;
  --fall-soft: rgba(63, 130, 255, 0.14);

  --neutral: #d6dde8;
  --accent: #8b7cff;
  --success: #31c48d;
  --warning: #f5b942;
  --danger: #ff5d6c;
}
```

한국 주식시장 관례에 맞춰:

* 상승: 빨강
* 하락: 파랑
* 보합: 회색

색상만으로 상태를 표현하지 않는다. 반드시 부호, 화살표 또는 텍스트를 함께 표시한다.

예:

* `▲ +1.24%`
* `▼ -0.86%`
* `― 0.00%`

### 11.3 타이포그래피

권장 폰트:

```css
font-family:
  Pretendard,
  "Noto Sans KR",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

숫자는 가능하면 tabular number를 사용한다.

```css
font-variant-numeric: tabular-nums;
```

가격 숫자:

* 모바일: 32~40px
* 데스크톱: 42~56px
* `font-weight: 700`
* 자간은 약간 좁게
* 원 단위는 숫자보다 작게

### 11.4 화면 레이아웃

데스크톱:

```text
┌──────────────────────────────────────────────────────────┐
│ 로고    시장 상태                 마지막 업데이트   설정 │
├──────────────────────────────────────────────────────────┤
│ 오늘 밤 시장이 반영한 한국 반도체 예상가격              │
│ 간단한 설명과 데이터 상태                               │
├───────────────────────┬──────────────────────────────────┤
│ 삼성전자 예상가격     │ SK하이닉스 예상가격             │
│ 큰 가격               │ 큰 가격                         │
│ 등락률 / 변동금액     │ 등락률 / 변동금액               │
│ 미니 차트             │ 미니 차트                       │
├───────────────────────┴──────────────────────────────────┤
│ 통합 가격 추이 차트                                      │
├──────────────────────────────┬───────────────────────────┤
│ 계산 기준                    │ 데이터 품질 및 시장 상태 │
└──────────────────────────────┴───────────────────────────┘
```

모바일:

```text
상단 헤더
시장 상태
삼성전자 카드
SK하이닉스 카드
종목 전환형 차트
가격 계산 근거
데이터 상태
면책 문구
```

모바일에서는 가로 스크롤이 생기지 않아야 한다.

### 11.5 종목 카드

각 카드에는 다음 정보를 표시한다.

* 회사명
* 국내 종목코드
* 예상 원화가격
* 한국 호가단위 반올림 표시
* 최근 국내 종가
* 예상 변동금액
* 예상 변동률
* 바이낸스 현재 기준가격
* 바이낸스 마감 기준가격
* Bid / Ask
* 스프레드
* 데이터 신뢰도
* 마지막 업데이트
* 미니 스파크라인

예시:

```text
삼성전자 · 005930

102,300원
▲ 2,300원  +2.30%

최근 국내 종가              100,000원
바이낸스 기준가격              73.42
국내 마감시 기준가격           71.77
호가 스프레드                   0.08%

데이터 상태 양호 · 12초 전
```

`102,300원` 아래에 작은 글씨로 다음 문구를 표시한다.

```text
한국거래소 호가단위로 반올림한 참고 예상가
```

### 11.6 카드 효과

* 배경은 단색 또는 매우 미세한 그라데이션
* 1px 반투명 테두리
* hover 시 2~4px 정도만 상승
* 그림자는 약하게 사용
* 상승 카드 전체를 빨갛게 만들지 않는다.
* 하락 카드 전체를 파랗게 만들지 않는다.
* 상승·하락 색상은 숫자와 작은 배경 강조에만 사용한다.
* 카드 상단에 기업별 작은 심볼 마크를 둘 수 있다.
* 삼성전자와 SK하이닉스 카드의 구조는 완전히 동일해야 한다.

### 11.7 애니메이션

가격이 변경될 때:

* 숫자가 부드럽게 전환된다.
* 상승 업데이트는 짧은 붉은색 플래시
* 하락 업데이트는 짧은 파란색 플래시
* 500ms 이내로 종료
* 지속적으로 깜빡이지 않는다.
* 사용자가 `prefers-reduced-motion`을 설정하면 애니메이션을 끈다.

페이지 최초 진입:

* 카드가 20px 이하의 거리에서 부드럽게 나타난다.
* 애니메이션 총시간은 600ms 이하로 유지한다.
* 로딩 때문에 콘텐츠가 크게 움직이지 않도록 스켈레톤 높이를 실제 카드와 일치시킨다.

---

## 12. 차트

차트는 과도한 트레이딩 도구처럼 만들지 않는다.

기본 기능:

* 삼성전자 / SK하이닉스 전환
* 1시간
* 6시간
* 24시간
* 주말
* 최근 7일

차트 표시값:

* 예상 원화가격
* 직전 국내 종가 기준선
* 데이터 누락 구간
* 업데이트 지연 구간

툴팁:

```text
2026.08.02 20:31
예상가격 102,300원
야간변동 +2.30%
바이낸스 기준가격 73.42
```

차트 축 가격도 한국 호가단위에 맞게 표시한다.

데이터가 충분하지 않을 때 임의의 가짜 그래프를 표시하지 않는다.

대신:

```text
가격 이력을 수집하고 있습니다.
데이터가 쌓이면 추이 차트가 표시됩니다.
```

라고 표시한다.

---

## 13. 날짜와 시장 상태

모든 사용자 표시 시간은 한국시간으로 변환한다.

표시 형식:

* 오늘 데이터: `20:31:42`
* 다른 날짜: `8월 2일 20:31`
* 상세 툴팁: `2026년 8월 2일 20:31:42 KST`

시장 상태 예시:

* 국내장 거래 중
* 국내장 마감
* 야간 참고가격
* 주말 참고가격
* 국내 휴장
* 데이터 지연
* 기준가격 갱신 필요

주말에는 다음 문구를 표시한다.

```text
주말에는 거래량과 유동성이 낮아 예상가격의 변동성이 커질 수 있습니다.
```

국내장이 열려 있는 시간에는 사이트의 역할이 달라질 수 있으므로 다음과 같이 표시한다.

```text
현재 한국거래소 정규장이 진행 중입니다.
본 예상가격보다 국내 실제 체결가격을 우선 확인하세요.
```

공휴일 판정 기능이 없다면 단순히 평일이라고 해서 반드시 거래일로 단정하지 않는다.

---

## 14. 1분 갱신 구현

기본 갱신 간격:

```ts
export const CLIENT_REFRESH_INTERVAL_MS = 60_000;
```

권장 훅:

```ts
export function useMinuteRefresh(
  callback: () => void | Promise<void>
) {
  useEffect(() => {
    let timer: number | undefined;
    let running = false;

    const run = async () => {
      if (running) return;

      running = true;

      try {
        await callback();
      } finally {
        running = false;
      }
    };

    void run();

    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void run();
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void run();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      if (timer) {
        window.clearInterval(timer);
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [callback]);
}
```

WebSocket을 사용하는 경우에도 UI 계산과 차트 샘플 저장은 1분 단위로 제한할 수 있다.

* 수신 데이터는 메모리에 최신값으로 유지
* 화면의 핵심 가격은 최대 1분 간격 또는 유의미한 변화 시 갱신
* 차트에는 1분 캔들 또는 1분 스냅샷 저장
* 컴포넌트가 초당 여러 번 재렌더링되지 않도록 한다

WebSocket 연결이 끊어지면:

1. 지수 백오프로 재연결
2. REST 조회로 임시 폴백
3. GitHub `latest.json`으로 최종 폴백

재연결 간격 예:

```text
1초 → 2초 → 4초 → 8초 → 15초 → 최대 30초
```

---

## 15. GitHub Actions 워크플로

### 15.1 데이터 업데이트

`.github/workflows/update-market-data.yml`

```yaml
name: Update market data

on:
  workflow_dispatch:
  schedule:
    - cron: "2-57/5 * * * *"

permissions:
  contents: write

concurrency:
  group: update-market-data
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 4

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Fetch and validate market data
        run: npm run data:update

      - name: Run data validation
        run: npm run data:validate

      - name: Commit updated data
        run: |
          if git diff --quiet; then
            echo "No data changes"
            exit 0
          fi

          git config user.name "market-data-bot"
          git config user.email "market-data-bot@users.noreply.github.com"

          git add public/data
          git commit -m "chore(data): update market snapshot"
          git push
```

주의:

* 작업이 실패했는데 빈 데이터로 파일을 덮어쓰지 않는다.
* 두 종목 중 한 종목만 실패한 경우 성공한 종목의 데이터만 안전하게 업데이트할 수 있다.
* 기존 정상 JSON은 항상 유지한다.
* 응답 검증이 실패하면 커밋하지 않는다.
* 워크플로가 중복 실행되어 충돌하지 않도록 `concurrency`를 사용한다.
* 데이터가 실제로 달라졌을 때만 커밋한다.

### 15.2 GitHub Pages 배포

`.github/workflows/deploy-pages.yml`

프로젝트 빌드 결과를 GitHub Pages에 배포한다.

Vite 사용 시 `base`를 저장소 이름에 맞게 설정한다.

```ts
export default defineConfig({
  base:
    process.env.NODE_ENV === "production"
      ? "/repository-name/"
      : "/",
});
```

커스텀 도메인을 사용하면 그에 맞게 조정한다.

---

## 16. JSON 스키마

`latest.json` 예시:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-02T11:30:00.000Z",
  "source": "github-actions",
  "stocks": {
    "samsung": {
      "displayName": "삼성전자",
      "koreanTicker": "005930",
      "binanceSymbol": "SAMSUNGUSDT",
      "krxClose": 100000,
      "baselineBinancePrice": 71.77,
      "currentBinancePrice": 73.42,
      "referencePriceMode": "mark",
      "rawEstimatedPrice": 102299.01,
      "estimatedPrice": 102500,
      "changeAmount": 2500,
      "changeRate": 0.025,
      "bidPrice": 73.4,
      "askPrice": 73.44,
      "spreadPercent": 0.0545,
      "confidenceScore": 88,
      "eventTime": "2026-08-02T11:29:58.000Z",
      "status": "healthy"
    },
    "skHynix": {
      "displayName": "SK하이닉스",
      "koreanTicker": "000660",
      "binanceSymbol": "SKHYNIXUSDT",
      "krxClose": 300000,
      "baselineBinancePrice": 215.4,
      "currentBinancePrice": 218.1,
      "referencePriceMode": "mark",
      "rawEstimatedPrice": 303760.45,
      "estimatedPrice": 304000,
      "changeAmount": 4000,
      "changeRate": 0.013333,
      "bidPrice": 218,
      "askPrice": 218.2,
      "spreadPercent": 0.0917,
      "confidenceScore": 84,
      "eventTime": "2026-08-02T11:29:58.000Z",
      "status": "healthy"
    }
  }
}
```

`history.json`은 배열이 무한히 커지지 않도록 제한한다.

권장:

* 최근 7일: 5분 단위
* 8~30일: 30분 단위 다운샘플링
* 그 이상: 일 단위 요약
* 또는 날짜별 파일 분리

GitHub 저장소에 초단위 원본 데이터를 계속 커밋하지 않는다.

---

## 17. 데이터 검증

Zod 스키마를 사용한다.

```ts
const QuoteSchema = z.object({
  symbol: z.string().min(1),
  lastPrice: z.number().positive().nullable(),
  markPrice: z.number().positive().nullable(),
  bidPrice: z.number().positive().nullable(),
  askPrice: z.number().positive().nullable(),
  eventTime: z.string().datetime(),
});
```

검증 규칙:

* 가격은 0보다 커야 함
* 타임스탬프는 유효해야 함
* 미래 시간이 과도하게 들어오면 거부
* Bid와 Ask가 모두 있으면 `bid <= ask`
* 사용할 기준가격은 반드시 하나 이상 존재
* 종목 심볼이 요청 심볼과 일치해야 함
* JSON 스키마 버전 확인
* 기준 종가와 기준 바이낸스 가격이 존재해야 예상가격 계산

---

## 18. 로딩·오류·빈 상태

### 로딩

* 실제 카드와 같은 높이의 스켈레톤 사용
* 전체 화면 스피너만 보여주지 않는다
* 기존 정상 데이터가 있으면 데이터를 유지하면서 작은 갱신 표시만 한다

### 네트워크 오류

```text
최신 시세 연결이 원활하지 않습니다.
마지막 정상 데이터로 표시하고 있습니다.
```

### 데이터 지연

```text
마지막 정상 업데이트가 8분 전입니다.
가격이 현재 시장 상황과 다를 수 있습니다.
```

### 기준가격 없음

```text
국내장 마감 기준가격이 아직 등록되지 않았습니다.
예상가격 계산을 준비하고 있습니다.
```

### 일부 종목 오류

한 종목 오류 때문에 전체 페이지를 오류 화면으로 바꾸지 않는다.

---

## 19. 접근성

* 텍스트 대비는 WCAG AA 이상을 목표로 한다.
* 키보드로 주요 컨트롤을 사용할 수 있어야 한다.
* 버튼에는 명확한 `aria-label`을 제공한다.
* 차트 정보는 표나 요약 텍스트로도 제공한다.
* 상승·하락을 색상만으로 구분하지 않는다.
* 애니메이션 감소 설정을 존중한다.
* 최소 터치 영역은 44px을 권장한다.
* 모바일 본문 글자 크기는 14px 미만으로 내리지 않는다.

---

## 20. SEO 및 메타데이터

페이지 제목 예:

```text
야간 반도체 예상가 | 삼성전자·SK하이닉스 참고가격
```

설명:

```text
바이낸스 연계상품의 야간 변동을 바탕으로 삼성전자와 SK하이닉스의 참고 예상가격을 제공합니다.
```

Open Graph 이미지에는 실제 숫자를 고정해서 넣지 않는다.

구조화된 데이터에서 이 서비스를 공식 거래소나 증권사로 표현하지 않는다.

---

## 21. 면책 문구

푸터와 정보 패널에 다음 문구를 표시한다.

```text
본 서비스의 예상가격은 바이낸스 연계상품의 가격 변동을 바탕으로 계산한 참고정보이며, 한국거래소의 실제 체결가격이나 다음 거래일 시가를 의미하지 않습니다. 상품의 유동성, 환율, 국내외 뉴스, 수급 및 장전 동시호가 등에 따라 실제 가격과 차이가 발생할 수 있습니다. 본 정보는 투자 권유 또는 매매 추천이 아닙니다.
```

짧은 버전:

```text
바이낸스 연계상품 기반 참고 예상가이며 실제 국내 체결가격과 다를 수 있습니다.
```

---

## 22. 성능 목표

* Lighthouse Performance 90 이상 목표
* 모바일 첫 화면 빠른 표시
* 초기 JavaScript 번들 최소화
* 차트 라이브러리 필요 시 lazy loading
* 이미지 최적화
* 불필요한 렌더링 방지
* 1분마다 전체 페이지를 새로고침하지 않음
* 데이터만 갱신
* GitHub JSON 요청에는 캐시 무효화용 쿼리 사용 가능

예:

```ts
fetch(`/data/latest.json?t=${Date.now()}`, {
  cache: "no-store",
});
```

단, 바이낸스 API를 과도하게 호출하지 않는다.

---

## 23. 테스트 요구사항

최소 테스트:

1. 호가단위 판정
2. 호가단위 반올림
3. 예상가격 계산
4. 0 또는 음수 입력 거부
5. 기준가격 누락 처리
6. 데이터 지연 판정
7. 상승·하락·보합 표시
8. 원화 포맷
9. 한국시간 포맷
10. API 응답 정규화
11. 일부 종목 실패 처리
12. GitHub 폴백 데이터 처리

빌드 전 실행:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

모든 명령이 성공해야 작업 완료로 본다.

---

## 24. 숫자 포맷

원화가격:

```ts
export function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value)}원`;
}
```

등락률:

```ts
export function formatPercent(value: number): string {
  const percent = value * 100;
  const sign = percent > 0 ? "+" : "";

  return `${sign}${percent.toFixed(2)}%`;
}
```

변동금액:

```ts
export function formatChangeAmount(value: number): string {
  const sign = value > 0 ? "+" : "";

  return `${sign}${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
```

보합은 `+0.00%`가 아니라 `0.00%`로 표시한다.

---

## 25. 개발 우선순위

### Phase 1: 핵심 MVP

* 프로젝트 초기 설정
* 두 종목 설정
* 바이낸스 시세 조회
* 기준가격 JSON
* 예상가격 계산
* KRX 호가단위 반올림
* 두 종목 카드
* 1분 브라우저 갱신
* GitHub Pages 배포
* 면책 문구

### Phase 2: 이력

* GitHub Actions 5분 수집
* `latest.json`
* `history.json`
* 24시간 차트
* 데이터 지연 상태
* 오류 폴백

### Phase 3: 완성도

* 데이터 신뢰도 점수
* 시장 상태
* 주말 표시
* 고급 애니메이션
* 반응형 세부 개선
* 접근성
* 성능 최적화

### Phase 4: 검증

* 예상가격과 실제 다음 거래일 시가 비교
* 일별 예측 오차 저장
* MAE
* MAPE
* 방향성 적중률
* 종목별 오차 통계

실제 검증 데이터가 쌓인 후에만 예측 정확도를 화면에 표시한다.

---

## 26. 완료 기준

다음 조건을 모두 만족해야 기능 구현이 완료된 것으로 본다.

* GitHub Pages에서 정상 접속된다.
* 개인 컴퓨터를 켜지 않아도 사이트가 열린다.
* 접속 후 1분마다 화면 데이터가 갱신된다.
* GitHub Actions가 5분마다 이력 갱신을 시도한다.
* 삼성전자와 SK하이닉스가 각각 독립적으로 표시된다.
* 예상가격이 국내 종가와 바이낸스 상대변동률로 계산된다.
* 예상가격이 한국거래소 호가단위에 맞게 반올림된다.
* 상승은 빨강, 하락은 파랑, 보합은 회색으로 표시된다.
* 모바일에서 화면이 깨지지 않는다.
* 데이터가 끊겼을 때 직전값과 지연 상태가 표시된다.
* 기준값이 없을 때 잘못된 예상가격을 만들지 않는다.
* 투자 권유가 아니라는 면책 문구가 보인다.
* 타입 검사, 테스트, 빌드가 모두 통과한다.
* 비밀키가 저장소나 브라우저에 포함되지 않는다.

---

## 27. Claude 작업 응답 규칙

Claude는 코드 작업을 수행한 후 다음 내용을 간단히 보고한다.

1. 변경한 파일
2. 구현한 기능
3. 주요 계산 방식
4. 실행한 테스트
5. 남아 있는 제약 또는 확인 사항

예:

```text
구현 완료

- 삼성전자·SK하이닉스 예상가격 카드 추가
- 바이낸스 기준가격 변동률 계산 추가
- KRX 호가단위 반올림 유틸리티 및 테스트 추가
- 브라우저 60초 갱신 추가
- GitHub Actions 5분 데이터 저장 워크플로 추가
- 모바일 반응형 UI 적용

검증:
- npm run lint 통과
- npm run typecheck 통과
- npm run test 통과
- npm run build 통과

주의:
- 국내 종가와 국내장 마감시 바이낸스 기준가격은 baseline.json에 갱신해야 함
```

Claude는 구현하지 않은 기능을 구현했다고 말하지 않는다.

---

## 28. 소유자 결정 오버라이드 (2026-08-02)

아래 항목은 소유자 결정으로 본 문서의 이전 조항보다 우선한다.

* 사용자에게 표시되는 모든 문구에서 "바이낸스", "USDT" 대신 **"해외 선물가격"** 계열 표현을 사용한다. 내부 코드 식별자, 설정, 데이터 필드명은 바이낸스 명칭을 유지해도 된다.
* 카드의 지표 라벨은 "현재 해외 선물가", "마감시 선물 기준가", "매수 / 매도 호가"를 사용한다.
* 11.4의 "계산 기준"(PriceBreakdown) 패널과 "데이터 품질 및 시장 상태"(MarketMetrics) 패널은 제거되었다. 복원하지 않는다.
* **기기 설정(`prefers-color-scheme`)이 기본이자 우선이다**(2026-08-12 소유자 결정으로
  "다크 모드 기본"에서 변경). 저장된 선택이 없으면 `data-theme`를 아예 붙이지 않고
  스타일시트의 미디어쿼리가 결정하게 한다. 열려 있는 동안 기기 설정이 바뀌면 따라간다.
  토글로 기기 설정과 다른 값을 고르면 그때만 `localStorage`에 저장하며,
  **다시 기기 설정과 같은 값을 고르면 저장을 지운다** — 두 번 누르면 기기 추종으로 돌아온다.
  이 "되돌아갈 길"을 없애면 한 번의 토글이 영구 고정이 되어 기기 설정을 영원히 무시한다.
* 21장 면책 문구의 "바이낸스 연계상품" 표현은 "해외 선물가격 연계상품" 표현으로 대체한다.
* 국내 종가 자동 수집은 소유자 요청으로 활성화되었다(`scripts/update-baseline.mjs`, 평일 06:40 UTC). 휴장일·검증 실패 시 기존 baseline을 유지한다.

### 28.1 브랜드·도메인 (2026-08-09, 브랜드 표기 2026-08-12 갱신)

* 서비스명은 **코스피 NOW**다(2026-08-12 소유자 결정으로 "KOSPI NOW"에서 변경).
  기존 "야간 반도체 예상가"는 사용하지 않는다.
  20장의 페이지 제목 예시는 `코스피 NOW | 야간선물·야선 기반 삼성전자·SK하이닉스 야간 시세`로 대체한다.
* **한글을 앞에 두는 이유는 검색이다.** 네이버는 질의를 토큰으로 나누는데, 사람들이 치는 토큰은
  `코스피`이고 `KOSPI`가 아니다. 로마자만 쓰면 사이트 이름이 검색어와 토큰을 하나도 공유하지 않았다.
* 헤더 로고 아래 보조 문구는 **"KOSPI NOW"**다(위아래가 뒤바뀌었다).
  로마자 표기는 도메인(`kospinow.com`)과 같으므로 버리지 않고 부제로 남긴다.
  `코스피 나우`는 keywords 메타에만 남긴다 — 화면에서 로고와 부제가 같은 말을 세 번 하게 된다.
* 브랜드 문자열은 `src/config/brand.ts`의 `BRAND_NAME` / `BRAND_NAME_LATIN` 하나로만 관리한다.
  이 이름은 두 번 바뀌었으므로(2.1장) 컴포넌트마다 적어 두지 않는다.
  `index.html`·`site.webmanifest`는 빌드 전 정적 파일이라 문자열을 직접 쓴다 — 함께 고쳐야 한다.
* `public/og-image.jpg`에는 아직 로마자 "KOSPINOW"가 그려져 있다. 이미지를 다시 만들 때 맞춘다.
* 단, **21장 면책 문구의 "해외 선물가격 기반"은 브랜드가 아니라 데이터 출처 고지이므로 그대로 유지한다.**
  브랜드 통일을 이유로 면책 문구에서 출처 설명을 지우지 말 것.
* 서비스 주소는 `https://kospinow.com`(apex)이며 `www`도 같은 사이트를 가리킨다.
  Vite `base`는 `/`이고, 저장소 하위 경로(`/stock_predict/`)는 더 이상 쓰지 않는다.
* Worker의 `ALLOWED_ORIGIN`은 apex와 www를 콤마로 구분해 함께 허용한다.

### 28.2 게시판 정책·헤드라인 문구 (2026-08-09)

* 게시판 **글·댓글 작성은 로그인 필수**다. 읽기는 로그인 없이 가능하다.
  익명 작성(`익명#xxxx`)은 소유자 결정으로 중단되었으며 기존 익명 글은 삭제되었다.
  IP 해시는 도배 차단 용도로만 계속 사용한다.
* 메인 헤드라인은 다음으로 고정한다.
  - 1행: `코스피 NOW`(= `BRAND_NAME`. 2026-08-12 브랜드 표기 변경에 따라 "코스피 나우"에서 바뀌었다)
  - 2행(강조): `해외 선물가격 기반 코스피 야간 선물` (2026-08-11 소유자 결정으로 "코스피 현재가"에서 변경)
    이 문구는 **이 사이트가 제공하지 않는 것**을 연상시킨다는 점을 알고 채택한 것이다.
    사이트가 보여주는 것은 삼성전자·SK하이닉스 참고 예상가이지 코스피200 야간선물 호가가 아니다.
    따라서 **21장 면책 문구와 카드의 "예상가" 캡션은 이 헤드라인이 유지되는 한 절대 제거하지 않는다.**
    실제 코스피200 야간선물 시세를 싣게 되면 이 주의는 해소된다.
  - 부제(장 마감·야간·주말): `야간, 주말 언제 어디서나 가격을 확인하세요.`
  - 부제(정규장 중): 기존대로 실제 체결가 우선 확인 안내를 유지한다.
* 카드 가격 아래 캡션은 소유자 결정으로 **"예상가"** 로 축약되었다(11.5장의 긴 문구를 대체).
* 축약으로 카드에서 "참고"라는 단서가 사라졌으므로, 이 표현이 실제 체결가로 읽히지 않게 하는
  책임은 **21장 면책 문구와 공유 이미지의 면책 한 줄**이 진다. 이 둘은 반드시 유지한다.
  둘 다 지우면 1장의 금지 표현("실시간 주가", "확정 개장가")과 사실상 같아진다.

### 28.3 실시간 채팅방 — 익명 참여 예외 (2026-08-10)

소유자 요청으로 **실시간 채팅방**을 추가했다. 이 절은 28.2의 로그인 정책에 대한
**범위를 좁힌 예외**이며, 그 밖의 조항을 바꾸지 않는다.

* **채팅방(`#chat`)은 로그인 없이 참여한다.** 소유자 결정이다.
* **게시판(`#board`)의 정책은 그대로다.** 글·댓글 작성은 여전히 로그인 필수이고,
  게시판의 익명 작성 중단(28.2)도 그대로 유효하다.
  이 절을 근거로 게시판을 익명화하지 않는다. 반대로, 28.2를 근거로 채팅방에
  로그인을 요구하도록 "되돌리지" 않는다. 두 기능은 정책이 다른 것이 정상이다.
* 채팅 표시 이름은 **서버가 만든다.** IP 해시(일별 회전)에서 파생한 `느긋한 수달` 형태다(형용사+명사).
  게시판에서 폐기된 `익명#xxxx` 접두어는 재사용하지 않는다 —
  같은 신원 체계로 읽히면 삭제된 익명 게시물과 혼동된다.
* **입장 캡차는 제거되었다(2026-08-10, 소유자 결정).** 모바일에서 챌린지를 푸는 데
  수 초가 걸려 입장이 느렸다. 그 결과 **"진짜 브라우저임을 강제하는 장치는 더 이상 없다."**
* 로그인도 캡차도 없으므로 남용 방어선은 다음 셋뿐이며, **세 가지 모두 서버에서 강제한다.**
  1. IP 해시 단위 전송 제한(2초 간격, 분당 15건)
  2. `moderatePost()` 검열 + 길이·공백 검사
  3. IP 해시 단위 **동시 소켓 수 제한**(`CHAT_MAX_SOCKETS_PER_IP`, 기본 25)
  이 중 하나라도 제거하면 방은 스크립트에 무방비다. 특히 3번은 캡차를 대체하는 장치다 —
  없으면 스크립트가 소켓을 무한히 열어 접속자 수를 부풀리고 방을 계속 깨워 둘 수 있다.
* 입장 티켓(30분, IP 해시에 서명 결합)은 캡차가 사라진 뒤에도 **연결 자격증명으로 유지한다.**
  Durable Object를 깨우기 전에 Worker에서 검증되므로, 탐색성 요청이 방을 깨우지 못한다.
* 메시지 보관은 **최근 500개 롤링 윈도우**다. 초과분은 오래된 것부터 서버가 삭제한다.
  보관 개수는 `src/lib/chat/config.ts`의 `CHAT_MESSAGE_CAP` 하나로만 관리한다.
* 채팅 백엔드는 **Cloudflare Durable Object**(`ChatRoom`, WebSocket Hibernation)다.
  D1은 소켓도 접속 상태도 표현할 수 없으므로 채팅에는 D1을 쓰지 않는다.
  단일 인스턴스가 소켓 집합(= 접속자 수)과 500개 윈도우를 함께 소유한다.
  `new_sqlite_classes` 마이그레이션은 선택이 아니다 — Workers Free 플랜에서 쓸 수 있는
  유일한 스토리지 백엔드가 SQLite다.
* 표시되는 접속자 수는 **열린 소켓 수**다. 한 사람이 탭을 두 개 열면 2로 센다.
  UI 문구를 "정확한 사람 수"로 단정하지 않는다.
* 사용자에게 보이는 이름은 **"실시간 채팅"** 이다. "채팅방"이라는 표현은 UI에 쓰지 않는다(소유자 결정).
  내부 식별자(`#chat`, `ChatRoom`, `CHAT_ROOM_NAME`)는 그대로 둔다.
* 실시간 채팅 진입은 **대시보드**에서만 제공한다. 토론방에는 채팅 링크를 두지 않는다(소유자 결정).
* **모바일 헤더는 다크모드·토론방·실시간 채팅을 오버플로 메뉴로 감춘다**(`HeaderMenu`).
  좁은 화면에서 한눈에 필요한 것은 시장 상태·연결 배지뿐이고, 인라인 컨트롤 다섯 개가
  그 배지를 읽을 수 없게 만들었다. 내비게이션과 테마는 찾아가는 동작이므로 탭 한 번을 감당한다.
  데스크톱은 인라인을 유지한다.
* 메인에는 **실시간 채팅 스트립만** 둔다(소유자 결정, 2026-08-11). 토론방 인기글 스트립은
  메인에서 제거했다 — 토론방은 헤더에서 들어간다. 채팅 스트립은 **히어로 바로 아래 최상단**이다.
* 스트립의 사용자 표기는 "실시간 채팅"이다. "최근 채팅"은 쓰지 않는다.
* 스트립은 **카드 전체가 채팅방으로 이동하는 버튼**이다.
  `PopularTicker`는 메인에서 빠졌지만 컴포넌트와 테스트는 남겨 두었다.
  그 안의 공감 버튼 `stopPropagation`은 되살릴 때 반드시 유지해야 한다 —
  없으면 공감 한 번에 화면이 토론방으로 튄다.
* 대시보드의 "최근 채팅" 스트립은 **소켓이 아니라 폴링**으로 읽는다(`GET /api/chat/recent`).
  대시보드 방문자마다 소켓을 열면 방에 들어오지도 않은 사람 때문에 방이 깨어나 hibernation이 무의미해진다.
  Worker가 미리보기를 캐시하므로 방은 캐시 주기당 1회만 읽힌다.
* 토론방과 채팅방 상단에는 삼성전자·SK하이닉스 예상가를 **작은 카드**로 함께 보여준다.
  대시보드 카드와 같은 훅을 쓰므로 페이지 간에 값이 어긋날 수 없다.
  이 두 페이지에는 자체 면책 문구가 없으므로, 미니 카드가 "해외 선물가격 기반 참고 예상가"임을
  직접 밝힌다(21장). 이 한 줄을 지우지 않는다.
* **동시 소켓 상한을 3처럼 작은 값으로 낮추지 않는다.** 사무실·카페·학교·CGNAT는
  하나의 공인 IP로 보이므로, 작은 상한은 실제 사용자를 429로 막는다. 이 상한의 역할은
  도배 차단이 아니라 자원 고갈 차단이며, 도배는 전송 제한이 담당한다.
* 규모 한계와 무료 플랜 한도 대조는 `docs/chat-api.md`의 "규모 한계" 절에 있다.
  **가장 먼저 막히는 자원은 rows written(메시지당 3행, 하루 약 33,000건)이다.**
  keepalive를 `setWebSocketAutoResponse`에서 일반 메시지 핸들러로 옮기면 과금이 발생한다 — 옮기지 말 것.
* 계약 문서는 `docs/chat-api.md`다. 프레임 모양과 상수는 그 문서를 기준으로 한다.
* 채팅방도 21장 면책 원칙을 따른다. "투자 권유가 아니다"라는 안내를 화면에서 지우지 않는다.

### 28.4 공유 이미지 — 미리보기 후 공유 (2026-08-12)

소유자 요청으로 카드의 이미지 버튼이 **"미리보기 → 공유/저장"** 두 단계가 되었다.

* **생성 즉시 내보내지 않는다.** 이전에는 PNG를 만들자마자 OS 공유 시트에 넘기거나
  다운로드 폴더에 떨어뜨렸기 때문에, 보내는 사람이 그림을 처음 보는 시점이
  **이미 나간 뒤**였다. 지금은 `SharePreviewModal`이 먼저 그림을 보여주고,
  공유·저장은 각각 별도의 탭이다. 이 순서를 되돌리지 않는다
  (`ShareCardButton.test.tsx`의 "does not send or download anything on its own"이 지킨다).
* **공유하기와 사진 저장을 둘 다 남긴다.** `navigator.canShare({files})`가 참일 때만
  공유하기를 띄우고, 파일 공유가 안 되는 브라우저(데스크톱 Chrome 등)에서는 저장만 보인다.
  저장은 어느 쪽에서든 항상 제공된다.
* 모달은 **`createPortal`로 `<body>`에 올린다.** 카드(`article`)는 `overflow-hidden`이고
  transform 애니메이션을 쓰므로, 그 안의 `fixed` 오버레이는 잘리고 z-index도 갇힌다
  (19장·`AppHeader`에서 겪은 것과 같은 함정).
* 이미지의 시각은 **상대시간이 아니라 절대 KST 시각**이다(`2026.08.12 22:41 KST 기준`).
  저장된 파일이 일주일 뒤에도 "10초 전"이라고 말하면 그건 거짓 신선도 주장이다(11.4장).
* **면책 한 줄과 "해외 선물가격 기반 참고 예상가" 캡션은 이미지에서 절대 빼지 않는다**(28.2).
  디자인을 다시 손대더라도 이 둘과 `kospinow.com`은 남긴다.
* 캔버스 높이는 상수 합(`CARD_BASE_H`)에서 계산하고, 면책 문구 줄 수만 사전 측정해 더한다.
  높이를 손으로 적어 두면 문구가 길어졌을 때 조용히 잘린다.
