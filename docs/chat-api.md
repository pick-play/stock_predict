# 실시간 채팅방 API 계약

프론트엔드(GitHub Pages)와 백엔드(Cloudflare Worker + Durable Object)가 공유하는 계약이다.
양쪽 구현은 이 문서를 기준으로 하며, 임의로 프레임 모양을 바꾸지 않는다.

## 원칙

- **로그인 없음.** 소유자 결정(CLAUDE.md §28.3)에 따라 채팅방만 익명 참여를 허용한다.
  게시판의 "글·댓글 작성 로그인 필수"(§28.2)는 그대로 유지된다.
- 표시 이름은 **서버가 만든다.** 클라이언트가 보낸 `handle`, `id`, `createdAt`은 전부 무시된다.
  이름은 IP 해시(일별 회전)에서 파생한 `손님#a3f2` 형태이며 날마다 바뀐다.
  게시판에서 폐기된 `익명#xxxx` 접두어는 **재사용하지 않는다** — 같은 신원 체계로 읽히면 안 된다.
- 원문 IP는 저장하지 않는다. `worker/src/lib/ipHash.ts`의 HMAC-SHA256 해시만 쓴다.
- 검열 판정은 `src/lib/moderation/filter.ts`의 `moderatePost()` 하나만 쓴다.
  브라우저는 입력 중 안내용, 서버는 최종 판정용으로 같은 함수를 호출한다.
- 로그인이 없으므로 **레이트리밋·검열·입장 확인이 유일한 남용 방어선이다.**
  세 가지 모두 서버에서 강제된다. 브라우저 검사를 통과했어도 서버가 거부하면 거부다.
- 메시지 보관은 **최근 500개 롤링 윈도우**다. 초과분은 오래된 것부터 서버가 삭제한다.

## 아키텍처

```text
브라우저
  │  ① POST /api/chat/ticket   (Turnstile 토큰 → 입장 티켓)
  │  ② GET  /api/chat/room     (WebSocket 업그레이드, ?ticket=)
  ▼
Cloudflare Worker  ── 오리진 검사 · 티켓 검증 · IP 해시 산출
  │  stub.fetch()  + X-Chat-Ip-Hash 헤더
  ▼
ChatRoom Durable Object (단일 인스턴스, WebSocket Hibernation)
     소켓 집합 = 접속자 수
     DO 스토리지 = 500개 롤링 윈도우
```

- **실시간 구간:** 메시지 전달과 접속자 수. 폴링이 아니라 Durable Object가 소켓으로 밀어 준다.
- **폴링 구간:** 없음. 클라이언트가 도는 타이머는 45초 keepalive 하나뿐이며,
  이 프레임은 DO의 auto-response 표에서 처리되어 방을 깨우지 않는다.

D1은 채팅에 **전혀 쓰지 않는다.** D1은 소켓도 접속 상태도 표현할 수 없다.
따라서 이 기능에는 D1 스키마 변경도, 새 마이그레이션도 없다.

## 공통

- Base URL: 게시판과 **같은** Worker 도메인. 프론트는 `VITE_BOARD_API_BASE` 하나만 쓴다
  (변수를 둘로 나누면 한쪽만 설정된 배포가 생길 수 있다). 비어 있으면 "준비 중" 화면만 표시한다.
- HTTP 요청/응답은 `application/json; charset=utf-8`.
- 오류 응답 공통 형태: `{ "error": "<code>", "message": "<사용자에게 보여줄 한국어 문구>" }`
- CORS: `ALLOWED_ORIGIN`(apex + www 콤마 구분) 및 `http://localhost:5173`만 허용.
  **WebSocket 업그레이드에는 브라우저가 CORS를 적용하지 않으므로** Worker가 `Origin`을
  직접 검사한다(`worker/src/routes/chat.ts`). 이 검사를 지우면 아무 페이지나 방에 붙을 수 있다.

## 타입

```ts
interface ChatMessage {
  id: string;         // 서버가 부여한 순번 문자열. 정렬·중복 판정 키
  body: string;       // 원문 그대로. 렌더링 시 프론트가 텍스트로 처리한다
  handle: string;     // "손님#a3f2" — 서버 생성, 일별 회전
  createdAt: string;  // ISO 8601 UTC
}
```

### 클라이언트 → 서버 프레임

```ts
type ChatClientEvent = { type: "message"; body: string };
```

이 한 가지뿐이다. 그 외 프레임(알 수 없는 `type`, 문자열이 아닌 `body`, 깨진 JSON)은
`rejected`(`code: "invalid"`)로 거부된다. 바이너리 프레임은 조용히 버린다.

문자열 `"ping"`은 프로토콜 프레임이 아니라 keepalive이며 서버가 `"pong"`으로 자동 응답한다.
클라이언트는 JSON 파싱 전에 이 값을 걸러야 한다.

### 서버 → 클라이언트 프레임

```ts
type ChatServerEvent =
  | { type: "hello";    handle: string; participants: number; messages: ChatMessage[] }
  | { type: "message";  message: ChatMessage }
  | { type: "presence"; participants: number }
  | { type: "rejected"; code: ChatRejectCode; message: string };

type ChatRejectCode = "invalid" | "empty" | "too-long" | "rejected" | "rate-limited";
```

- `hello`: 접속 직후 1회. 자기 이름, 현재 접속자 수, 최근 **50개** 백로그.
  재연결 시에도 `hello`가 다시 오며, 클라이언트는 이 목록으로 화면을 **교체**한다
  (끊긴 동안 무엇이 남아 있는지는 서버만 안다).
- `message`: 새 메시지 브로드캐스트. 보낸 사람도 같은 프레임을 받는다(에코 확인).
- `presence`: 접속자 수 변화. 입장·퇴장·오류 종료 시 나머지 참가자에게 보낸다.
- `rejected`: 직전 전송 거부. 보낸 사람에게만 간다.

`participants`는 **열린 소켓 수**다. 한 사람이 탭 두 개를 열면 2로 센다.
UI 문구도 "명 접속 중"으로 쓰고 사람 수라고 단정하지 않는다.

## 엔드포인트

### POST /api/chat/ticket

Turnstile 토큰을 짧은 수명의 입장 티켓으로 교환한다.

- 본문: `{ "turnstileToken": string }`
- 200: `{ "ticket": string, "expiresAt": string }` — `expiresAt`은 ISO 8601 UTC, 유효기간 30분
- 400 `invalid-body`: JSON 형식 오류
- 403 `captcha-failed`: Turnstile 검증 실패
- 503 `chat-unavailable`: `CHAT_ROOM` Durable Object 바인딩이 없는 배포

**왜 티켓인가.** Turnstile 토큰은 1회용이다. 매 재연결마다 캡차를 다시 요구하면
회선이 불안정한 사용자만 계속 벌을 받는다. 티켓은 서명에 IP 해시를 묶어 두므로
다른 곳에 넘겨도 쓸 수 없다. 서명 키는 새 시크릿을 만들지 않고 기존 `IP_SALT`에
도메인 구분자(`|chat-ticket-v1`)를 붙여 파생한다.

**왜 로그인 대신 캡차인가.** 방이 익명이면 IP 해시 단위 레이트리밋만 남고,
그건 봇넷 앞에서 정의상 무력하다. 티켓 수명당 캡차 1회는 실제 브라우저를 강제하는
가장 가벼운 마찰이다.

### GET /api/chat/room?ticket=&lt;ticket&gt;

WebSocket 업그레이드. 성공하면 101을 반환하고 이후 통신은 위의 프레임 규약을 따른다.

- 403 `invalid-ticket`: 티켓이 없거나 형식 오류, 만료, 또는 다른 IP 해시로 발급된 것
  (어느 쪽인지 구분해 알려주지 않는다)
- 403 `forbidden-origin`: 허용되지 않은 `Origin`
- 426 `expected-websocket`: `Upgrade: websocket` 헤더 없음
- 503 `chat-unavailable`: Durable Object 바인딩 없음

모든 검사는 Durable Object를 건드리기 **전에** Worker에서 끝낸다.
검증되지 않은 탐색 요청이 DO 요청 비용까지 쓰게 만들 이유가 없다.

## 서버 규칙 (`src/lib/chat/config.ts`)

| 상수 | 값 | 의미 |
|---|---:|---|
| `CHAT_MESSAGE_CAP` | 500 | 보관 메시지 수. 초과분은 오래된 것부터 삭제 |
| `CHAT_MESSAGE_MAX_LENGTH` | 300 | 메시지 최대 길이(게시판 1,000자보다 짧게) |
| `CHAT_HISTORY_LIMIT` | 50 | `hello`가 실어 보내는 백로그 개수 |
| `CHAT_SEND_MIN_INTERVAL_MS` | 2,000 | 같은 IP 해시의 연속 전송 최소 간격 |
| `CHAT_RATE_WINDOW_MS` / `MAX` | 60,000 / 15 | 같은 IP 해시의 1분당 전송 상한 |
| `CHAT_TICKET_TTL_MS` | 1,800,000 | 입장 티켓 수명(30분) |
| `CHAT_PING_INTERVAL_MS` | 45,000 | 클라이언트 keepalive 주기 |

### 거부 순서

1. 바이너리 프레임 → 조용히 버림
2. 프레임 파싱 실패 → `invalid`
3. **레이트리밋** → `rate-limited`
4. 빈 문자열·공백만 → `empty`
5. 길이 초과 → `too-long`
6. `moderatePost()` 거부 → `rejected`

레이트리밋을 검열보다 **먼저** 두는 것은 의도적이다. 거부된 텍스트가 무료라면
검열 필터 자체가 무제한으로 두드릴 수 있는 통로가 된다. 그래서 거부되는 메시지도
전송 슬롯을 소비한다.

길이 검사는 `moderatePost()`보다 앞에 있다. 공유 필터는 5,000자 붙여넣기에
게시판 기준인 "1000자 이내"를 답하는데, 그건 채팅 사용자에게 보여줄 숫자가 아니다.

`moderatePost()`는 2자 미만도 거부하므로 `ㅋ` 한 글자는 채팅에서도 거부된다.
필터를 채팅용으로 갈라내면 규칙이 두 벌이 되므로 이 제약을 그대로 받아들였다.

## 500개 롤링 윈도우

Durable Object 스토리지 레이아웃:

```text
chat:m:<12자리 순번>  → { body, handle, createdAt }
chat:cursor           → { oldestSeq, nextSeq }
```

- 0을 채운 키라 사전순 = 숫자순이므로 백로그 읽기가 prefix list 한 번으로 끝난다.
- 커서가 있어 삭제 판단이 메시지당 O(1)이다. 매번 키를 세면 윈도우 크기에 비례해 느려진다.
- **경쟁 안전성:** DO는 단일 스레드지만 단일 작업은 아니다. 두 메시지가 거의 동시에 오면
  둘 다 첫 `await`에서 양보하므로, 직렬화가 없으면 같은 순번을 읽어 한 줄이 사라진다.
  그래서 `ChatMessageStore.append()`는 프로미스 체인으로 순서를 강제한다.
- 삭제를 쓰기보다 **먼저** 한다. 삭제가 실패하면 아무것도 움직이지 않고 발신자가 재시도한다.
  삭제는 됐는데 쓰기가 실패하면 커서가 삭제된 구간을 가리킨 채 남지만, 다음 append가
  더 큰 초과분을 계산해 같은 범위를 다시 지우므로 산술은 그대로 맞는다(범위 시작이 공백을 흡수한다).

구현: `src/lib/chat/messageStore.ts`.
`worker/` 아래가 아니라 공유 트리에 있는 이유는 `moderation/filter.ts`와 같다 —
저장소의 단일 Vitest 프로젝트가 단위 테스트할 수 있어야 하기 때문이다.
스토리지 의존성은 주입되는 인터페이스이므로 이 파일은 Cloudflare 타입을 import하지 않는다.

## Worker 시크릿·바인딩

| 이름 | 종류 | 용도 |
| --- | --- | --- |
| `CHAT_ROOM` | Durable Object 바인딩 | `ChatRoom` 클래스. `new_sqlite_classes`로 마이그레이션 |
| `TURNSTILE_SECRET` | Secret | 입장 티켓 발급 시 Turnstile 검증 (게시판과 공유) |
| `IP_SALT` | Secret | IP 해시 + 티켓 서명 키 파생 (게시판과 공유) |
| `ALLOWED_ORIGIN` | 환경변수 | CORS 및 WebSocket `Origin` 검사 (게시판과 공유) |

**새 시크릿은 없다.** 채팅은 게시판이 이미 쓰는 시크릿만 사용한다.

`new_sqlite_classes`는 선택이 아니다. 키-값 스토리지 백엔드는 신규 네임스페이스에
더 이상 제공되지 않고, Workers Free 플랜에서 쓸 수 있는 유일한 백엔드가 SQLite다.

## 로컬 개발

```bash
cd worker
cp .dev.vars.example .dev.vars   # TURNSTILE_SECRET은 테스트 키라 항상 통과
npm install
npm run dev                      # http://localhost:8787 — Durable Object도 로컬 시뮬레이션
```

프론트는 `.env`에 `VITE_BOARD_API_BASE=http://localhost:8787`을 넣으면 붙는다.
`VITE_TURNSTILE_SITE_KEY`가 비어 있으면 입장 화면이 캡차 없이 바로 통과를 시도하고,
서버는 `TURNSTILE_SECRET`이 비어 있을 때만 이를 받아준다(운영에서는 항상 설정되어 거부된다).
