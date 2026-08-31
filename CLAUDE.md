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
* **기준가는 항상 최근 종가다. 시가 앵커는 쓰지 않는다**(2026-08-18 소유자 결정).
  시가는 정규장 시간에만 적용됐는데, 그 시간대는 사이트가 "실제 체결가를 먼저
  확인하라"고 안내하는 구간이다. 기준점을 두 개 유지하는 비용(수집·검증·설명)에
  비해 얻는 게 없었다. `resolveAnchor()`는 시각 인자도 받지 않는다 — 시간에 따라
  답이 달라지지 않으므로.
  **부작용을 알고 채택한 것이다**: 정규장 중에는 기준가가 전일 종가가 되고 등락률의
  측정 구간이 하루 더 길어진다.
  `baseline.json`의 `open` 블록과 `AnchorKind`의 `"open"`은 남긴다 — 같은 일봉에서
  공짜로 따라오는 값이고, 되돌릴 때 스키마 변경이 아니라 리졸버 수정으로 끝난다.
  open으로 떨어지는 경우는 **종가가 아예 없을 때 하나뿐이다.**
* 시가 앵커용 09:20 워크플로는 제거했다. 아무도 읽지 않는 값을 매일 커밋하고
  배포까지 유발하고 있었다. 15:40 실행이 시가·종가를 함께 기록한다.
* **모바일은 시세 소켓을 열지 않는다. REST 4초 폴링이다**(2026-08-17, 발열 조사 결과).
  측정값: `bookTicker`가 두 심볼에 대해 **초당 103.8프레임**(30초에 653KB, 시간당 약
  78MB, 초당 JSON 파싱 약 100회)을 보낸다. 렌더는 1초로 묶여 있었지만 수신은 아니고,
  초당 100패킷을 받는 모뎀은 절전 상태로 내려가지 못한다 — 이것이 발열의 주범이었고
  블러·리렌더보다 훨씬 크다.
  **더 느린 스트림으로 바꾸는 선택지는 없다**: TradFi 심볼에서 `markPrice@1s`,
  `markPrice`, `ticker`, `aggTrade`를 모두 실제로 구독해 봤고 **전부 0프레임**이다.
  그래서 기기로 갈랐다 — `prefersPolledFeed()`가 `pointer: coarse`를 보고,
  폰은 `fetchStockQuote` 폴링(심볼당 153바이트, 시간당 약 0.7MB), 데스크톱은 소켓.
  두 경로 모두 `latestWsQuotesRef`를 거쳐 같은 재가격 코드로 들어간다 — 폰과 PC의
  예상가가 갈라질 수 없다. **탭이 숨으면 폴링을 멈춘다**(요청마다 무선 칩이 깨어난다).
  소켓을 다시 모바일에 켜지 말 것.
* **채팅 키프레임은 답을 기다려야 한다**(`CHAT_PONG_TIMEOUT_MS`, 10초).
  핑을 보내는 것만으로는 아무것도 증명되지 않는다. 잠자다 깨어난 폰은 TCP가 반쯤
  죽은 채로 `readyState === OPEN`을 보고하고 `send()`는 예외 없이 바이트를 버리며,
  `onclose`는 커널이 포기하는 수 분 뒤에야 온다. 그 사이 방은 "연결됨"으로 보이면서
  아무것도 받지 않는다 — 이것이 "모바일에서 채팅이 안 뜬다"의 실제 정체였다.
  화면 복귀 처리기도 **OPEN이면 핑만 쏘고 리턴하던 것을 고쳤다.** 그 조기 리턴을
  되살리지 말 것.
* **상대시간은 0에서 자른다**(`formatRelativeTime`). 시계는 1초에 한 번 스냅샷을 받고
  시세는 초당 100번 시각을 찍으므로, 신선한 시세가 오래된 시계보다 앞서는 일이
  정상적으로 발생하고 `Math.floor(-0.4)`는 -1이다. `-1초 전`이 그렇게 나왔다.
* 헤더의 "N초 전" 표시는 제거했다(2026-08-17 소유자 결정). 옆의 `실시간` 배지가 이미
  같은 뜻이고, 가격의 나이는 각 카드가 자기 하단에 표시한다.
* **국내장 개장 여부는 달력이 아니라 관측된 세션으로 판단한다**(2026-08-17).
  `isKrxTradingHours()`는 요일과 시간만 알기 때문에, 광복절 대체공휴일이던
  2026-08-17 월요일 내내 사이트가 "국내장 거래 중"이라고 표시했다. **공휴일 목록을
  하드코딩하지 않는다** — 대체·임시공휴일과 선거일을 매년 사람이 미리 채워 넣어야
  하고 빠뜨리면 같은 일이 반복된다. 대신 `useKrxSession()`이 시세 피드의 코스피
  세션 상태(야후 `currentTradingPeriod` → Worker의 open/closed/unknown)를 우선
  사용하고, 피드가 없을 때만 달력으로 떨어진다. 평일 장중인데 닫혀 있으면 휴장이다.
* **로컬 개발은 Vite 프록시로 API를 부른다**(`vite.config.ts`의 `/api` → Worker).
  Worker의 `ALLOWED_ORIGIN`에는 kospinow.com만 있어서 localhost에서 직접 부르면
  200이 와도 CORS 헤더가 없어 브라우저가 버린다. **운영 CORS 목록에 localhost를
  추가하지 말 것.** `.env.development`가 API 주소를 비워 두면 `resolveApiBase()`가
  개발 모드에서 현재 origin을 쓰고, 프록시가 전달한다. 주소가 비면 기능이 꺼지는
  `is…Configured` 규칙이 있으므로 **빈 주소만 두고 끝내면 피드가 아예 죽는다.**
* 위 두 건은 단위 테스트를 모두 통과한 채로 두 번 연속 실패했다. 실패한 지점이
  provider→context 사이였는데 테스트가 그 컨텍스트를 목으로 채우고 있었기 때문이다.
  `MarketStatusBadge.wiring.test.tsx`는 네트워크 경계만 목으로 두고 그 경로를
  실제로 통과시킨다 — 이 테스트를 지우지 않는다.
* 국내 종가 자동 수집은 소유자 요청으로 활성화되었다(`scripts/update-baseline.mjs`, 평일 06:40 UTC). 휴장일·검증 실패 시 기존 baseline을 유지한다.
* **데이터 워크플로의 푸시는 재시도한다**(2026-08-14). 그날 종가 실행은 야후에서 값을
  정상적으로 받아 커밋까지 만들어 놓고 `git push`가 GitHub의 `HTTP 500`으로 끊겨
  통째로 죽었다 — 데이터는 멀쩡한데 하루치가 사라졌다. 5회까지 재시도하며 매회
  `git pull --rebase`로 다른 봇 커밋과의 경합도 함께 흡수한다.
  **리베이스는 커밋 해시를 바꾸므로 `sha` 출력은 반드시 푸시 성공 뒤에 읽어야 한다** —
  배포 대기 단계가 그 해시를 기다린다.
* 야후 조회도 3회까지 재시도한다(`withRetries`). 한 번의 네트워크 실패로 그날 앵커가
  통째로 비는 것을 막는다.
* **GitHub cron은 보장이 아니다**(2026-08-27·28 이틀 연속 실측). 27일은 예약 실행이
  통째로 누락됐고, 28일은 캐치업 포함 세 슬롯이 **모두 9~12시간 지연**돼 자정을 넘긴
  토요일 KST에 도착했다 — 당시의 주말 가드가 셋 다 "주말 휴장 스킵"으로 버려서
  금요일 종가가 주말 내내 비었다. 캐치업만으로는 부족했다: 하루가 통째로 밀리면
  캐치업도 같이 밀린다.
* 그래서 **스크립트는 실행 시각이 아니라 데이터로 판단한다**(2026-08-29).
  `lastTradingDayKST()`가 목표 거래일을 정하므로 주말·심야에 도착한 실행도 금요일
  봉으로 수렴하고, 15:31 준비 게이트는 **목표가 오늘일 때만** 적용된다(지난 날의
  봉은 이미 확정돼 있다). 주말 가드를 되살리지 말 것 — 그 가드가 28일 사고의
  절반이다. 주말 오전 슬롯(10:40 KST)도 같은 이유로 존재한다.
* **종가의 최종 보증은 GitHub이 아니라 Cloudflare cron이 진다**(2026-08-31 세 번째
  사고 후). 8/31 월요일엔 저녁 슬롯 두 개가 또 통째로 누락돼 종가가 밤까지 비었다 —
  수렴 로직은 지연은 살려내지만 **실행 자체가 없으면 아무것도 못 한다.** 같은
  스케줄러 안에서 슬롯을 늘리는 것(평일 매시로 증설함)은 확률을 올릴 뿐 보증이
  아니므로, Worker의 감시자 cron(`worker/src/lib/baselineWatchdog.ts`, 평일 저녁
  매시 45분 + 주말 2회)이 **배포된 사이트의** `baseline.json` 앵커 날짜를 확인하고
  뒤처져 있으면 `update-baseline.yml`을 직접 dispatch한다. git은 최신인데 사이트만
  낡았으면(8/12 배포 경쟁 부류) `deploy-pages.yml`만 깨운다. dispatch에는 Worker
  시크릿 `GITHUB_DISPATCH_TOKEN`(Actions write)이 필요하며, 없으면 로그만 남기고
  물러선다. 시각 기준을 사이트가 아니라 git으로 바꾸지 말 것 — 사용자가 보는 것은
  배포본이고, git만 보면 "커밋됐는데 배포 안 됨"이 영원히 안 잡힌다.
  감시자 tick은 시간당 1회 수준이라 폴링 예산(28.3)에 유의미한 영향이 없다.
* **전 종목 조회 실패는 exit 1이다.** 예전엔 0으로 끝나 Actions 목록에 초록 체크로
  남았다 — 사이트가 어제 종가를 내보내는 동안 아무도 모른다. 빨간 실행이어야
  GitHub이 소유자에게 메일을 보낸다. 날짜 불일치(공휴일)는 계속 조용히 끝난다.
* **종가 앵커의 선물가격 샘플링은 15:33이다**(2026-08-26 소유자 제보로 수정).
  종가 자체는 15:30 동시호가로 확정되지만, 바이낸스 계약이 그 숫자를 아는 데 1~2분
  걸린다 — 8/21·24·25 측정에서 두 대형주 모두 06:31~06:32 UTC 캔들에 한 방향 점프가
  있었고(8/25 하이닉스 0.4%) 06:33부터 안정됐다. 06:30:00 정각에 앵커를 찍으면 그
  정산 점프가 **밤새 유령 등락률로 실렸다** — 마감 5분 뒤 카드가 -0.4%를 보여줬다.
  오프셋은 `CLOSE_ANCHOR_SETTLE_MINUTES`(3분) 하나로 관리하며 **샘플링 시각에만**
  적용된다 — marketDate·표시 라벨·meta 종가 검증은 진짜 15:30 기준 그대로다.
* **앵커 시각을 20시(NXT 마감)로 옮기지 않는다**(2026-08-14 검토 후 소유자 결정으로 현행 유지).
  데이터 소스인 야후 `005930.KS` 일봉의 종가는 15:30에 확정되고 그 뒤로 바뀌지 않으므로
  20시에 받아도 같은 숫자다. 반면 기록을 미루면 15:30~20:00 동안 close 앵커가 **전일자**로
  남아, 그 시간대 예상가가 하루치 변동으로 측정된다.

### 28.1 브랜드·도메인 (2026-08-09, 브랜드 표기 2026-08-12 갱신)

* 서비스명은 **코스피 NOW**다(2026-08-12 소유자 결정으로 "KOSPI NOW"에서 변경).
  기존 "야간 반도체 예상가"는 사용하지 않는다.
  20장의 페이지 제목 예시는 `코스피 NOW | 야간선물·야선 기반 삼성전자·SK하이닉스 야간 시세`로 대체한다.
* **한글을 앞에 두는 이유는 검색이다.** 네이버는 질의를 토큰으로 나누는데, 사람들이 치는 토큰은
  `코스피`이고 `KOSPI`가 아니다. 로마자만 쓰면 사이트 이름이 검색어와 토큰을 하나도 공유하지 않았다.
* **헤더는 워드마크 한 줄뿐이다**(2026-08-22 소유자 결정). 파비콘 이미지와 아래의
  "KOSPI NOW" 보조 문구를 없앴다 — 한 이름을 세 가지로 겹쳐 놓은 구석이었다.
  `코스피`는 본문색, `NOW`는 브랜드 보라로 칠한다(`BRAND_NAME_KO` / `BRAND_NAME_NOW`).
  **로마자 표기는 푸터 본문으로 옮겼다.** 도메인과 같은 표기라 화면에서 완전히
  사라지면 안 된다 — 검색엔진은 찾을 수 있는 텍스트만 매칭한다.
* 브랜드 문자열은 `src/config/brand.ts`의 `BRAND_NAME` / `BRAND_NAME_LATIN` 하나로만 관리한다.
  이 이름은 두 번 바뀌었으므로(2.1장) 컴포넌트마다 적어 두지 않는다.
  `index.html`·`site.webmanifest`는 빌드 전 정적 파일이라 문자열을 직접 쓴다 — 함께 고쳐야 한다.
* `public/og-image.jpg`는 2026-08-31 새 로고 기반으로 교체되어 "코스피 NOW" 표기를 따른다.
  원본(1536×1024)은 `design/share-image-source.png`이고, 배포본은 세로를 자르지 않고
  좌우 흰 패딩으로 1200×630을 만든 것이다 — 세로를 자르면 맨 아래 `kospinow.com`
  줄이 잘린다(28.4가 지키는 그 줄).
* **404 페이지는 `public/404.html` 하나로 독립적이다**(2026-08-14). GitHub Pages가
  존재하지 않는 **모든** 경로에 이 파일을 내보내며, 여기에는 배포 직후 예전 탭이
  요청하는 사라진 청크도 포함된다. "없습니다"를 말하려고 앱 번들을 받게 하면
  사이트에서 가장 싸야 할 응답이 가장 비싸진다 — **여기에 번들·광고·애널리틱스를
  넣지 않는다.** CSS는 인라인이고 테마는 index.html과 같은 방식으로 첫 페인트 전에
  적용한다.
* 404 페이지는 `/board`·`/chat`만 해시 주소로 리다이렉트한다. 앱이 해시로
  라우팅하므로 그 둘은 없는 페이지가 아니라 형식이 다른 주소다.
  **`/admin`은 이 목록에 넣지 않는다** — 주소를 찍어본 사람에게 관리 콘솔의 존재를
  알려주게 된다(28.5). 같은 이유로 그 사실을 설명하는 주석조차 배포되는 HTML에
  남기지 않는다.
* **이름의 세 가지 표기를 모두 검색되게 유지한다**(2026-08-12): `코스피나우`(붙여쓰기),
  `코스피 NOW`, `KOSPI NOW`. 검색엔진은 **찾을 수 있는 텍스트만** 매칭하므로
  세 표기가 다음 네 곳에 존재해야 한다 — `<title>`/`og:title`(코스피 NOW),
  `description`의 앞머리 `코스피 NOW(코스피나우)`, `keywords` 메타, 그리고
  JSON-LD의 `alternateName` 배열. 푸터에는 `BRAND_NAME_HANGUL`이 실제 본문 텍스트로
  들어간다 — 메타 태그만으로는 약하고 본문에 있는 표기가 더 강하게 잡힌다.
* JSON-LD 타입은 **`WebSite`**다. `FinancialService`로 바꾸지 않는다 —
  20장이 금지하는 "거래소·증권사처럼 표현"에 정확히 해당한다.
* 단, **21장 면책 문구의 "해외 선물가격 기반"은 브랜드가 아니라 데이터 출처 고지이므로 그대로 유지한다.**
  브랜드 통일을 이유로 면책 문구에서 출처 설명을 지우지 말 것.
* 서비스 주소는 `https://kospinow.com`(apex)이며 `www`도 같은 사이트를 가리킨다.
  Vite `base`는 `/`이고, 저장소 하위 경로(`/stock_predict/`)는 더 이상 쓰지 않는다.
* Worker의 `ALLOWED_ORIGIN`은 apex와 www를 콤마로 구분해 함께 허용한다.

### 28.2 게시판 정책·헤드라인 문구 (2026-08-09)

* 게시판 **글·댓글 작성은 로그인 필수**다. 읽기는 로그인 없이 가능하다.
  익명 작성(`익명#xxxx`)은 소유자 결정으로 중단되었으며 기존 익명 글은 삭제되었다.
  IP 해시는 도배 차단 용도로만 계속 사용한다.
* **메인의 헤드라인 3줄은 제거했다**(2026-08-22 소유자 결정). 헤더가 이미 사이트를
  밝히고 있고, 폰에서 그 세 줄이 가격을 화면 밖으로 밀어냈다. 그 줄이 지고 있던
  키워드(`해외 선물가격 기반 코스피 야간 선물`, `야간선물·야선`, `야간·주말 언제
  어디서나…`)는 **푸터 본문으로 옮겼다** — 검색은 위치가 아니라 존재를 본다.
  정규장 경고와 주말 안내만 남으며, 둘 다 해당 없으면 히어로는 아무것도 렌더하지
  않고 헤더 다음이 바로 실시간 채팅이다.
  아래 문구는 히어로가 있던 동안의 기록이다.
  - 1행: `코스피 NOW`(= `BRAND_NAME`. 2026-08-12 브랜드 표기 변경에 따라 "코스피 나우"에서 바뀌었다)
  - 2행(강조): `해외 선물가격 기반 코스피 야간 선물` (2026-08-11 소유자 결정으로 "코스피 현재가"에서 변경)
    이 문구는 **이 사이트가 제공하지 않는 것**을 연상시킨다는 점을 알고 채택한 것이다.
    사이트가 보여주는 것은 삼성전자·SK하이닉스 참고 예상가이지 코스피200 야간선물 호가가 아니다.
    따라서 **21장 면책 문구와 카드의 "예상가" 캡션은 이 헤드라인이 유지되는 한 절대 제거하지 않는다.**
    실제 코스피200 야간선물 시세를 싣게 되면 이 주의는 해소된다.
  - 부제(장 마감·야간·주말): `야간, 주말 언제 어디서나 가격을 확인하세요.`
  - 부제(정규장 중): 기존대로 실제 체결가 우선 확인 안내를 유지한다.
* **주말 유동성 안내 배너는 제거했다**(2026-08-22 소유자 결정). 13장이 요구하던
  문구지만, 참이면서 상시적이었다 — 7일 중 이틀 내내 같은 말을 띄우는 것은 경고가
  아니라 가구이고, 폰에서 주말 내내 가격을 아래로 밀었다. 21장 면책 문구가 예상가가
  실제 체결가가 아니라는 것을 주 7일 내내 말한다. 정규장 안내만 남는다.
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
* **표시되는 접속자 수는 사이트 전체 접속자다**(2026-08-22 소유자 결정으로 "열린
  소켓 수"에서 변경). 대부분의 방문자는 채팅에 들어오지 않으므로, 소켓 수는 정직하지만
  쓸모가 없었다 — 대화가 오가는 옆에서 "2명"은 사이트의 트래픽이 아니라 방의 공허함을
  설명한다.
  방(`ChatRoom`)이 `sitePresence: Map<ipHash, lastSeen>`를 들고, 열린 소켓의 IP
  해시와 **합집합**으로 센다(방에 있는 사람도 사이트에 있는 사람이므로 두 번 세면 안 된다).
* **이 맵은 30초마다 한 행으로 저장한다**(`CHAT_PRESENCE_FLUSH_MS`, 2026-08-22).
  처음엔 메모리에만 뒀는데 접속자 수가 **톱니처럼 늘었다 훅 떨어졌다** — Durable
  Object는 플랫폼 사정으로 언제든 재시작·이전되고 **배포할 때마다 반드시 그렇게 되며**,
  그때마다 사이트에 있는 모든 사람이 카운트에서 사라졌다가 각자의 다음 핑(최대 1분)에
  하나씩 돌아왔다. 숫자는 자기 상태에 대해 정직했고 세상에 대해 틀렸다.
  **핵심은 "맵 전체를 한 행으로, 시간 제한을 걸어" 쓴다는 것이다** — 방문자당 쓰지
  않으므로 쓰기 횟수가 접속자 수에 비례하지 않는다(하루 약 2,900회 고정 vs. 무료
  플랜 약 33,000회). 핑마다 쓰면 방문자당 분당 1행이 되어, 이 설계가 피하려던 바로
  그 비용이 된다.
  생성자에서 `blockConcurrencyWhile`로 **먼저 읽고 나서** 요청을 받는다 — 읽는 도중에
  빈 방을 보고하면 안 된다.
  IP 해시 기준이므로 **하한이지 인원수가 아니다**(한 사무실은 1). UI는 계속 "접속"이라
  쓰고 정확한 사람 수라고 단정하지 않는다.
* 프론트는 `useSitePresence()`가 `POST /api/chat/presence`를 **60초마다, 보이는
  탭에서만** 보낸다(`App.tsx`에 마운트 — 라우트 안에 넣으면 해시가 바뀔 때마다
  타이머가 재시작되고, 호출을 빠뜨린 페이지의 독자는 세어지지 않는다).
* **숫자가 바뀌면 방이 소켓으로 알린다.** 이전에는 presence 프레임이 소켓 열림·닫힘
  때만 나가서, 채팅에 앉아 있는 사람은 입장할 때 받은 숫자를 계속 들고 있었다
  (제보: "다시 들어와야 바뀐다"). 핑으로 카운트가 실제로 달라졌을 때만 브로드캐스트하므로
  조용한 사이트에서는 0건이다.
* **숫자 하나를 위해 전용 폴링을 만들지 않는다**(2026-08-23 장애). 5초마다
  `GET /api/chat/count`를 읽는 훅을 넣었다가 **사이트 전체가 죽었다** — Workers Free는
  워커 전체에 하루 10만 요청이고, 이 폴링 하나가 탭당 시간당 720건, 사이트가 하던
  나머지 전부(약 360건)의 두 배였다. 하루 수용량이 277 방문자-시간에서 92로 떨어졌고
  오후에 한도를 다 써서 채팅·게시판·**금·유가·지수**까지 전 API가 429(Cloudflare 1027)로
  응답했다. 한도는 배포가 아니라 00:00 UTC에 리셋된다.
  **판단 착오는 캐시를 보고 안심한 것이다** — 워커의 공유 캐시가 Durable Object 읽기를
  접속자 수와 무관하게 유지하는 것은 사실이지만, 구속 조건은 **워커 자신의 요청 수**이고
  방 앞의 캐시는 거기에 아무 영향이 없다.
* **접속 알림은 이미 하고 있는 요청에 얹는다**(2026-08-24). 대시보드는 미리보기 폴링에
  `?presence=1`을 붙여 보내고(HTTP 요청 추가 0건), 미리보기가 없는 게시판에서는
  `useSitePresence()`가 자체 POST를 보낸다. 둘은 `presenceClock.ts`라는 **공용 시계**를
  먼저 확인하므로 같은 분에 두 번 알리지 않는다.
  주기 관계가 중요하다: 알림 간격(60초) + 미리보기 주기(30초) = 최악 90초로,
  서버 만료(150초) 안에 반드시 들어와야 한다. 셋 중 하나를 바꾸면 나머지를 확인할 것
  (`presenceClock.test.ts`가 이 부등식을 고정한다).
* **폴링 예산은 사이트 전체가 공유한다.** 탭 하나·1시간 기준으로
  미리보기 120(30초) + 티커 80(45초) + 인기글 12 + 캘린더 1 ≈ **213건**,
  하루 약 470 방문자-시간이다. 새 폴링을 더할 때는 이 표에 더해 보고,
  **10만을 그 합으로 나눈 값이 감당할 트래픽인지** 먼저 계산할 것.
  **이 핑은 미리보기 캐시와 달리 방을 깨운다.** 그게 이 기능의 비용이고 알고 택했다 —
  아무도 사이트에 없는 새벽에는 핑도 없으므로 hibernation은 그대로 유효하다.
  주기를 줄이면 Durable Object 요청이 그대로 배로 늘어난다.
* **팝업이 열려 있는 동안에는 스트립이 소켓의 줄을 쓴다**(`livePreview.ts`).
  스트립은 20초 폴링에 서버 10초 캐시가 겹쳐 있어서, 바로 위에 열린 팝업보다 최대
  30초 뒤처졌다 — 같은 방의 두 화면이 눈에 띄게 어긋난다. 팝업이 소켓으로 받은 것을
  모듈 스토어에 게시하고 스트립이 그걸 우선한다. **닫아도 지우지 않는다** — 폴링이
  한 주기 안에 따라잡고, 닫는 순간 화면에서 가장 최신인 줄이 사라지는 것이 더 나쁘다.
* 사용자에게 보이는 이름은 **"실시간 채팅"** 이다. "채팅방"이라는 표현은 UI에 쓰지 않는다(소유자 결정).
  내부 식별자(`#chat`, `ChatRoom`, `CHAT_ROOM_NAME`)는 그대로 둔다.
* 실시간 채팅 진입은 **대시보드**에서만 제공한다. 토론방에는 채팅 링크를 두지 않는다(소유자 결정).
* **모바일 헤더는 다크모드·토론방·실시간 채팅을 오버플로 메뉴로 감춘다**(`HeaderMenu`).
  좁은 화면에서 한눈에 필요한 것은 시장 상태·연결 배지뿐이고, 인라인 컨트롤 다섯 개가
  그 배지를 읽을 수 없게 만들었다. 내비게이션과 테마는 찾아가는 동작이므로 탭 한 번을 감당한다.
  데스크톱은 인라인을 유지한다.
* 메인에는 **실시간 채팅 스트립만** 둔다(소유자 결정, 2026-08-11). 토론방 인기글 스트립은
  메인에서 제거했다 — 토론방은 헤더에서 들어간다.
* **스트립은 종목 카드 아래로 내려갔다**(2026-08-22 소유자 결정으로 "히어로 바로 아래
  최상단"에서 변경). 폰에서 대화가 가격이 있어야 할 자리를 차지했다. 대신 오른쪽
  아래에 **채팅 런처**(`ChatLauncher`)를 띄워 페이지 어디서나 방을 연다 — 스트립은
  이제 들어가는 길이 아니라 무슨 얘기가 오가는지 보여주는 미리보기다.
* **팝업은 열기 전까지 아무것도 마운트하지 않는다**(`ChatPopup`). 닫혀 있으면
  `useChatRoom`이 호출되지 않으므로 티켓도 소켓도 없다 — 방문자마다 소켓을 열면
  Durable Object가 계속 깨어 hibernation이 무의미해진다는 규칙이 그대로 적용된다.
  닫으면 언마운트되며 소켓도 함께 닫힌다. `ChatPopup.test.tsx`의 "joins no room
  until the button is pressed"가 이것을 고정한다.
* **폰에서는 팝업을 열지 않고 `#chat` 페이지로 이동한다**(2026-08-22, 사용자 제보).
  "채팅 치다가 자꾸 꺼진다" — 폰 키보드는 뷰포트를 줄이고 포커스를 옮기는데, 페이지의
  스크롤 컨테이너 밖에 있는 `fixed` 패널은 그때 서 있기 가장 취약한 자리다. 전체
  페이지는 잃을 그 기하가 없다.
  경계는 **패널 자신의 스타일과 같은 768px**(`useMediaQuery("(min-width: 768px)")`)로
  본다 — 입력 장치가 아니라 "어떤 레이아웃이 그려질 뻔했는가"가 기준이다. 좁은
  데스크톱 창도 같은 문제다. `matchMedia`가 없으면 false, 즉 안전한 쪽(페이지)이다.
  따라서 팝업은 사실상 데스크톱 전용이고, 시트 레이아웃은 좁은 데스크톱 창에서만 나온다.
* **미니 카드는 폰에서만 팝업 안에 넣는다**(`md:hidden`). 폰의 시트는 화면을 다
  덮으므로 방금 보던 가격이 사라진다 — 페이지 버전과 같은 이유로 방이 가격을 데리고
  가야 한다. 데스크톱 패널은 가격이 그대로 보이는 대시보드 위에 떠 있고, 34rem
  상자 안에 카드 두 장을 더 넣으면 이미 화면에 있는 숫자에 대화의 3분의 1을 내주는
  셈이다.
* 팝업은 `createPortal`로 `<body>`에 올린다 — 대시보드 카드가 `overflow-hidden` +
  transform이라 그 안의 `fixed`는 잘리고 z-index도 갇힌다(28.4와 같은 함정).
* **오른쪽 아래 코너에는 두 개가 산다.** 채팅 런처가 코너를 갖고, 앱 설치 버튼이
  그 위로 쌓인다(`InstallButton`의 `BOTTOM_OFFSET`). 둘 다 `fixed right-4`이므로
  한쪽 오프셋만 바꾸면 겹친다.
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
* 모바일 지표 행 구성은 2026-08-21의 상세보기 도입으로 대체되었다(28.8 참조).
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
* 이미지의 캡션은 카드와 같은 **"예상가"** 한 단어다(2026-08-22 소유자 결정으로
  "해외 선물가격 기반 참고 예상가"에서 축약). 줄여도 되는 이유는 아래 면책 문구가
  그대로이기 때문이다 — **이제 그 한 줄이 이미지의 정직함을 혼자 떠받친다.**
  면책 문구와 `kospinow.com`은 어떤 디자인 변경에서도 빼지 않는다(28.2).
* 캔버스 높이는 상수 합(`CARD_BASE_H`)에서 계산하고, 면책 문구 줄 수만 사전 측정해 더한다.
  높이를 손으로 적어 두면 문구가 길어졌을 때 조용히 잘린다.

### 28.5 관리자 콘솔·검열 정책 (2026-08-12)

소유자 결정: **"너무 막으면 채팅 자체가 안 쳐지니까, 삭제할 수 있는 시스템을 만들자."**
검열의 무게중심을 사전 차단에서 사후 삭제로 옮겼다.

#### 필터

* `moderatePost()`의 초성 규칙은 **자모로 입력한 구간에만** 적용한다(`jamoRuns`).
  이전에는 문장 전체를 초성으로 투영해 부분일치시켰기 때문에, 인접한 두 음절의 초성이
  ㅅ+ㅂ 또는 ㅂ+ㅅ이면 욕설로 읽혔다 — **부산, 밥상, 배송, 복수, 방심, 소방, 상방,
  사볼까, 사봤음이 모두 거부됐다.** 평범한 문장 26개 중 9개가 막히는 상태였다.
  **음절을 초성으로 투영해 부분일치시키는 방식으로 되돌리지 말 것.**
* `ㅗ`는 런 전체가 ㅗ일 때만 막는다. 부분일치시키면 감탄 표현 `ㅗㅜㅑ`가 함께 막힌다.
* `시ㅂ`, `ㅅ발` 같은 반자모 표기는 어간 목록에 직접 넣는다. 자모 런 규칙은 음절에
  붙은 자모를 보지 못한다.
* 어간 목록은 `normalize()`를 통과시켜 보관한다. NFKC가 호환 자모(ㅂ, U+3142)를
  결합 자모(U+1107)로 바꾸므로, 정규화하지 않은 어간은 정규화된 본문과 절대 일치하지 않는다.
* 목록을 늘리는 것으로 문제를 풀지 않는다. 놓친 것은 삭제로 처리한다.

#### 관리자 콘솔 `#admin`

* **비밀번호와 토큰은 서로 다른 값이다.** 짧고 기억하는 비밀번호(`ADMIN_PASSWORD`)는
  `POST /api/admin/login` **하나에서만** 검사하고, 성공하면 길고 무작위한
  `ADMIN_TOKEN`을 돌려준다. 이후 모든 관리 API는 그 토큰만 받는다.
  **짧은 비밀번호를 베어러 토큰으로 쓰지 말 것** — 삭제 API에 6자리 숫자를 그대로
  대입할 수 있게 된다.
* 로그인 시도는 **매 요청마다 IP 해시로 기록한 뒤** 10분 10회 초과를 429로 막는다.
  기록을 검사보다 먼저 하는 순서를 바꾸지 않는다. 시도 기록은 `login_attempts`
  테이블을 회원 로그인과 공유한다(컬럼이 `(ip_hash, created_at)` 뿐이라 구분이 없다) —
  같은 주소에서 회원 로그인을 여러 번 실패하면 콘솔 진입도 10분 지연된다.
* 브라우저의 판단은 장식이다. 비밀번호 확인은 반드시 서버 왕복이어야 한다.
* 토큰은 `sessionStorage`에 둔다(`kospinow:admin-token`). 탭과 함께 사라져야 하므로
  `localStorage`로 옮기지 않는다. 401을 받으면 즉시 지우고 잠금 화면으로 되돌린다.
* `#admin`은 **어디에서도 링크하지 않는다.** 이것은 보안 경계가 아니라 동선 정리다.
* **잠긴 화면은 자기 정체를 밝히지 않는다**(2026-08-12 소유자 결정). 로그인 전에는
  "관리" 제목·방패 아이콘·탭이 모두 없고, 라벨은 그냥 "비밀번호"다.
  탭과 삭제 버튼은 토큰이 있을 때만 렌더된다 — `AdminPage.test.tsx`의
  "while locked"가 이를 고정한다. 이것도 보안이 아니라 초대장을 없애는 것이다.
  경계는 여전히 서버가 판정하는 비밀번호 하나다.
* 채팅 삭제는 `POST /api/chat/admin/delete`이며 `{ids:[...]}` 또는 `{handle:"..."}`를 받는다.
  Durable Object가 삭제 후 `{type:"deleted", ids}`를 **전원에게** 브로드캐스트하므로
  이미 화면에 뿌려진 줄도 사라진다. 삭제 성공 시 Worker의 미리보기 캐시를 비운다 —
  비우지 않으면 대시보드 스트립이 TTL 동안 삭제된 줄을 계속 보여준다.
* 삭제는 `messageStore`의 커서를 건드리지 않는다. 커서는 개수가 아니라 시퀀스 **구간**을
  추적하므로, 중간에 구멍이 나면 구간이 지나갈 때까지 보관량이 500보다 잠깐 적어진다.
  여기서 `oldestSeq`를 다시 쓰면 가장 오래된 줄을 지웠을 때 윈도가 상한을 넘어 자란다.
* 채팅 내역 조회에서 `?limit=`은 **관리자에게만** 허용하며 캐시를 우회한다.
  일반 요청은 캐시된 8줄 그대로다 — 방문자마다 방을 깨우면 hibernation이 무의미해진다.

### 28.7 채팅 고정닉·출석·컨트롤 어휘 (2026-08-18)

* **로그인하면 채팅에 고정 닉네임으로 참여한다**(소유자 결정). 익명 참여는 그대로다(28.3).
  **이름은 서버가 서명한다**: 세션 토큰은 `POST /api/chat/ticket` 한 곳에만 실리고,
  워커가 DB로 검증한 닉네임을 티켓에 HMAC으로 넣는다. 소켓 핸드셰이크에는 자격증명이
  가지 않으며(URL·로그에 남으면 안 된다), 방은 워커가 세팅한 헤더만 신뢰하고
  클라이언트가 보낸 동명 헤더는 지운다. **프레임에서 이름을 받지 말 것.**
  IP 바인딩과 달리 닉네임 바인딩은 안전하다 — 네트워크가 바뀌어도 닉네임은 안 바뀐다.
* 티켓 페이로드는 **길이 접두어**로 조립한다. 구분자로만 이으면 닉네임에 구분자를 넣어
  다른 만료시각으로 재해석시키는 위조가 가능하다. 닉네임의 `.`은 `%2E`로 인코딩한다.
* **닉네임에는 띄어쓰기를 쓸 수 없다**(`src/lib/auth/nickname.ts`, 서버·폼 공용).
  위생 문제이기도 하지만 **사칭 방지가 본질**이다: 익명 별칭은 항상 `형용사 공백 명사`라
  띄어쓰기가 불가능하면 회원 닉네임이 별칭과 같아질 수 없다. 1,600개 조합 전부를
  테스트가 확인한다. 이 규칙을 완화하면 채팅의 `회원` 배지가 유일한 방어선이 된다.
* 출석은 `users` 테이블의 3개 컬럼(`last_visit_date`, `visit_days`, `visit_streak`)이다.
  방문 로그 테이블을 만들지 않는다 — 회원당 하루 한 행이 영원히 쌓이고, 무료 플랜에서
  가장 먼저 막히는 자원이 rows written이다(28.3). 날짜는 **한국 달력 날짜 문자열**이고,
  기록은 `GET /api/auth/me`에서만 한다(`requireAuth`에 넣으면 요청마다 쓴다).
  연속 출석은 2일 이상일 때만 표시한다 — 돌아온 사람에게 "연속 1일"은 지적이다.
* **컨트롤 모양은 `src/components/common/controls.ts` 세 단계뿐이다.**
  `PILL_PRIMARY`(화면당 하나) / `PILL_SURFACE`(내비·계정) / `PILL_QUIET`(카드 안 동작).
  헤더 버튼을 예쁘게 만들자 기존 글이 초라해 보인 원인은 **카드 안 동작에 모양이 아예
  없어서**였다. 피드의 모든 줄에 채워진 버튼을 넣지 말 것 — quiet 단계는 평소 투명하고
  접촉할 때만 형태가 생긴다.
* **게시판 첫 로드는 진행 중인 로드를 밀어내고 새로 시작한다**(`useBoardPosts.refresh`).
  StrictMode가 이펙트를 마운트→정리→재마운트하는데, 락을 걸어두면 재마운트가 락에 막혀
  리턴하고 첫 요청은 abort로 아무것도 저장하지 않는다. 결과는 **DB에 글이 있는데
  "아직 글이 없습니다"** — 개발 서버에서만 나타나 오래 살아남았다. `loadMore`의 락은
  유지한다(2페이지 요청은 정말로 기다려야 한다).

### 28.8 대시보드 카드·주말 판정 (2026-08-21 ~ 22)

* **카드의 우선순위는 종목명 → 가격 → 등락이다.** 이름은 24/30px, 가격은 clamp로
  가장 크고, 등락은 가격 **바로 아래 자기 줄**에 18~20px로 놓는다. 등락을 가격 옆에
  두면 각주로 읽히고, 채워진 배지에 담으면 시선이 분산된다. 나머지(지표·상태·시각)는
  전부 11~12px로 내린다. §11.2대로 색만으로 방향을 말하지 않는다 — `▼`와 부호를 함께.
* **계산 근거는 상세보기 뒤에 접는다.** 밖에 남기는 것은 `최근 국내 종가` 한 줄뿐이다
  — 그게 없으면 위의 가격이 무엇 대비인지 알 수 없다. 현재 해외 선물가·기준가·호가·
  스프레드는 열었을 때 **화면 크기와 무관하게 전부** 보인다(연 사람이 요청한 것이다).
  `desktopOnly` 변형은 없앴다.
* 카드가 열려도 옆 카드가 늘어나지 않도록 그리드에 **`items-start`**를 준다. 차트를
  카드 안에 뒀을 때와 같은 실패다.
* 액션 3개(차트·상세·공유)는 **한 클래스(`ACTION_CLASS`)를 공유하는 3등분 그리드**다.
  공유 버튼은 자기 스타일을 버리고 카드가 주는 클래스를 입는다. 카드 맨 아래에
  폭을 꽉 채워 놓아야 카드에 바닥이 생긴다.
* 카드 하단의 **`코스피 NOW` 마크는 9px·투명도 60%·`aria-hidden`**이다. 화면을 잘라
  캡처한 그림에 출처를 남기는 용도이며, 줄을 하나 더 만들거나 버튼을 줄이지 않는다.
* **공유 이미지는 카드와 같은 모양을 따른다**: 배지 대신 가격 아래 등락 한 줄,
  3행 패널 대신 종가 한 줄, 이름 오른쪽에 로고, 오른쪽 끝에 같은 스파크라인.
  **두 곳이 같은 규칙을 쓰는 것이 규칙 자체보다 중요하다** — 한쪽만 바꾸면 저장한
  그림이 방금 본 화면과 다른 색으로 나온다.
* **스파크라인 색은 카드의 등락률로 정한다**(2026-08-22 소유자 결정). 한동안 시리즈의
  첫 점 대비 마지막 점으로 칠했는데, 그 둘은 측정 구간이 다르다 — 최근 몇 시간이
  종가 대비 방향과 반대로 움직이면 **빨간 숫자 밑에 파란 선**이 놓였다.
* **카드의 큰 배경 차트는 만들었다가 되돌렸다**(2026-08-22). 가격 블록 뒤 전체 폭,
  오른쪽 위 모서리 배경까지 시도했고 둘 다 소유자 결정으로 원래의 썸네일로 돌아왔다.
  대신 썸네일을 키웠다(88×30 → 폰 108×36, 데스크톱 132×44). 크기는 `className`으로
  주고 뷰박스는 고정이다 — SVG의 width 속성에는 브레이크포인트를 쓸 수 없다.
* 차트 기본 범위는 **24시간**이다(2026-08-22 소유자 결정으로 6시간에서 변경).
  24시간이 국내 정규장 구간까지 포함하는 것은 맞지만, 차트를 여는 사람은 저녁 몇
  시간의 꼬리가 아니라 하루가 어디서 시작했는지를 본다.
* 차트의 기간·종목 칩은 **테마 토큰으로만** 칠한다. 선택된 칩이
  `bg-rgba(255,255,255,0.08)` + `text-#f4f7fb`였던 탓에 **라이트 모드에서 흰 바탕에
  흰 글씨**가 됐다. 차트 안의 기준선·테두리·커서도 같은 이유로 토큰으로 바꿨다.
* **주말은 미국 마감부터다**(2026-08-22 소유자 결정). 한국 토요일 00시는 뉴욕이 아직
  금요일 오후장을 하는 시간이고, 그때 "거래량이 적다"고 안내하는 것은 열려 있는 시장을
  설명하는 것이다. 경계는 **뉴욕 시계로 계산한다** — 시차가 서머타임에 9시간, 아닐 때
  10시간이라 KST 05:00으로 박으면 1년의 절반이 틀린다. 끝은 그대로 한국 월요일 0시.
* 헤더의 아래 선은 **안쪽 행에 붙인다.** 여백을 가진 요소에 붙이면 컨테이너 폭을 다
  가로질러 카드보다 좌우로 튀어나온다.
* 로그인 컨트롤은 **세 페이지 모두**(대시보드·커뮤니티·채팅)에 있다. 데스크톱은
  인라인, 모바일은 오버플로 메뉴. 어느 페이지에서 가입하든 **복구 코드 모달**이 떠야
  한다 — 비밀번호를 잃었을 때의 유일한 경로다.

### 28.6 앱 설치 버튼 (2026-08-13)

모바일에서만 오른쪽 아래에 떠 있는 **"앱 설치"** 버튼(`InstallButton`).

* **두 플랫폼은 방식이 다르다.** 안드로이드 크롬은 `beforeinstallprompt`를 주므로
  탭 한 번으로 설치되고, iOS 사파리에는 **그런 API가 없다** — 공유 → 홈 화면에 추가를
  사용자가 직접 해야 한다. 그래서 iOS에서는 설치하는 척하지 않고 안내 카드를 연다.
  이 차이는 기능 감지로 구분할 수 없다("아직 안 왔다"와 "영원히 안 온다"가 구분되지
  않는다). 이 저장소에서 UA 스니핑을 하는 유일한 곳이 `src/lib/pwa/install.ts`다.
* **버튼 문구는 "앱 설치"지만, iOS 안내 카드는 "홈 화면에 추가"를 그대로 인용한다.**
  그것이 사파리 메뉴에 실제로 적혀 있는 항목 이름이다. 브랜드 통일을 이유로 안내
  문구까지 "앱 설치"로 바꾸면, 사파리에 없는 항목을 찾게 만든다.
* iPadOS 13+는 자신을 `Macintosh`로 보고한다. `maxTouchPoints > 1`로 구분하며,
  이 분기를 지우면 아이패드에서 버튼이 사라진다.
* **안드로이드에서는 이벤트가 도착하기 전까지 버튼을 띄우지 않는다.** 크롬이
  설치 가능하다고 판정하지 않았거나 이미 설치된 상태이므로, 눌러도 아무 일이
  일어나지 않는 버튼이 된다. `InstallButton.test.tsx`가 이를 고정한다.
* `beforeinstallprompt`는 **React 마운트 전에 한 번** 발생하고 다시 요청할 수 없다.
  그래서 `index.html`의 부트 스크립트가 `window.__installPromptEvent`에 담아 둔다.
  이 스크립트를 지우면 안드로이드에서 버튼이 뜨지 않는다.
* **`public/sw.js`는 아무것도 캐시하지 않는다.** 존재 이유는 하나 — 크롬이
  서비스워커(+fetch 핸들러) 없는 사이트에는 `beforeinstallprompt`를 주지 않는다.
  이 사이트의 존재 이유가 최신 가격이므로 cache-first 워커는 어제 숫자와 낡은 번들을
  태연히 내놓는다. **캐싱을 추가하지 말 것.** activate 단계에서 남은 캐시를 지우는
  코드도 같은 이유로 남겨 둔다.
* 위치는 하단 시세 바(2.5rem)와 홈 인디케이터(`env(safe-area-inset-bottom)`) 위다.
  대시보드에만 렌더한다 — 채팅은 입력창이, 게시판은 글쓰기 버튼이 그 자리를 쓴다.
* 닫으면 30일간 다시 뜨지 않는다. 영구 차단은 하지 않는다.

### 28.7 종목 7개·야간 상하한가·코스피200 야간 (2026-08-22)

* **대상 종목은 7개다**(소유자 요청): 삼성전자, SK하이닉스, 현대차, 삼성전기,
  LG전자, 한미반도체, NAVER. 목록은 `src/config/symbols.ts`의 `STOCK_IDS` **하나로만**
  관리한다 — 화면마다 id를 적어 두면 새 종목이 어떤 화면에는 들어가고 어떤 화면에는
  빠진다(대시보드가 실제로 그 상태였다).
  예외는 토론방·채팅방 상단의 `StockMiniCards`뿐이며, 거기는 의도적으로 두 종목만
  보여준다(`MINI_CARD_IDS`). 대화가 주인공인 화면에서 일곱 줄은 첫 메시지를 화면
  밖으로 밀어낸다.
* **모바일은 1열, `md` 이상에서 2열이다**(2026-08-22 소유자 결정으로 "모든 폭에서
  2열"에서 변경). 375px 화면에서 카드가 165px가 되자 카드가 아래로 흐르는 대신
  **안의 글자가 줄어드는** 문제가 생겼다 — 가격 하한이 19px까지 내려갔고 스파크라인은
  아예 숨겼다. 두 번째 열은 결국 숫자 크기에서 빼 온 것이었다.
  차트는 **자기를 연 행 바로 아래**에 붙는다. 행의 단위가 폰에서는 카드 1개,
  데스크톱에서는 2개이므로 요소마다 `order-N`과 `md:order-N`을 함께 단다.
  **Tailwind는 소스 텍스트를 스캔하므로 `order-${n}` 같은 계산식은 CSS를 만들지
  않는다** — 배열에 문자열로 적어 둔다(7행이면 14까지 필요해 꼬리는 `order-[13]`).
* **야간 등락은 ±8%에서 자른다**(`NIGHT_SESSION_LIMIT_RATE`). 국내 야간거래의
  상하한폭이고, 클램프는 **가격이 아니라 등락률에** 건다 — 가격을 먼저 만들고 자르면
  화면의 등락률과 가격이 서로 다른 계산을 말하게 된다. `rawEstimatedPrice`는 자르지
  않은 값 그대로 남겨 두고, 잘렸다는 사실은 `limited`로 알린다.
* **코스피200 야간 스트립은 만들었다가 제거했다**(2026-08-22). 소스가 죽어 있었다.
  KRX 파생 시세는 라이선스 대상이라 이 사이트에는 코스피200 야간선물 호가가 없고,
  대신 바이낸스의 **KODEX 200 연계 계약**(`KODEX200USDT`)을 프록시로 썼다.
  계산도 앵커(15:30 KST = 06:30 UTC)도 맞았지만 **그 계약이 사실상 거래되지 않는다**:
  24시간 거래대금 59만 달러 · 체결 5,808건 · 마지막 체결 3.9분 전. 같은 시각
  삼성전자 계약은 3.55억 달러 · 100만 건 · 6초 전이었다(**거래대금 600배 차이**).
  그 결과 스트립이 -0.2%를 말할 때 구성종목이 함의하는 값은 -1.3%(커버 외 종목
  보합 가정) ~ -2.7%(커버 종목 평균)였다 — 삼성전자 혼자 -4.05%였기 때문이다.
  **되살리지 말 것.** 유동성·신선도 가드를 붙이면 거의 항상 숨겨져 자리만 차지하고,
  가드 없이 두면 방금처럼 1% 넘게 틀린 숫자를 지수처럼 보여준다. 프록시를 바꾸는
  것도 답이 아니다 — 우리가 커버하는 7종목은 지수의 약 49%뿐이라, 나머지를 보합으로
  가정한 숫자에 "코스피200"이라는 이름을 붙이는 것이 된다(1장·28.2가 금지하는
  "가지고 있지 않은 시세에 대한 주장").
  라이선스된 KRX 야간선물 피드가 생기면 그때 다시 만든다.
