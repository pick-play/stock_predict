# 익명 토론방 API 계약

프론트엔드(GitHub Pages)와 백엔드(Cloudflare Worker)가 공유하는 계약이다.
양쪽 구현은 이 문서를 기준으로 하며, 임의로 필드를 바꾸지 않는다.

## 원칙

- 로그인 없음. 사용자 식별자는 저장하지 않는다.
- 원문 IP를 저장하지 않는다. 하루 단위로 회전하는 솔트로 HMAC-SHA256 해시만 저장한다
  (도배 차단과 익명 표시자 생성에만 사용).
- 검열 판정은 `src/lib/moderation/filter.ts`의 `moderatePost()` 하나만 쓴다.
  브라우저는 입력 중 안내용으로, Worker는 최종 판정용으로 동일 함수를 호출한다.
- Worker가 최종 권한을 가진다. 브라우저 검사를 통과했어도 Worker가 거부하면 거부다.

## 공통

- Base URL: 배포된 Worker 도메인. 프론트는 `VITE_BOARD_API_BASE` 환경변수로 주입받는다.
- 모든 요청/응답은 `application/json; charset=utf-8`.
- CORS: `https://pick-play.github.io` 오리진만 허용. 로컬 개발은 `http://localhost:5173` 추가 허용.
- 오류 응답 공통 형태: `{ "error": "<code>", "message": "<사용자에게 보여줄 한국어 문구>" }`

## 타입

```ts
interface BoardPost {
  id: string;            // 숫자 문자열 (D1 rowid 기반, 커서로도 사용)
  body: string;          // 원문 그대로. 렌더링 시 프론트가 이스케이프한다
  authorTag: string;     // 예: "익명#a3f2" — IP해시+일자솔트에서 파생, 날마다 바뀜
  createdAt: string;     // ISO 8601 UTC
  reportCount: number;
}
```

## 엔드포인트

### GET /api/posts

목록 조회. 최신순.

- 쿼리: `cursor`(선택, 이 id보다 작은 글부터), `limit`(선택, 기본 20, 최대 50)
- 200: `{ "posts": BoardPost[], "nextCursor": string | null }`
- 숨김 처리된 글(`hidden_at IS NOT NULL`)은 제외한다.

### POST /api/posts

글 등록.

- 본문: `{ "body": string, "turnstileToken": string, "website": string }`
  - `website`는 허니팟. 사람에게는 보이지 않는 입력이며, 값이 비어있지 않으면
    성공(201)처럼 응답하되 저장하지 않는다(봇에게 실패를 알리지 않기 위함).
- 201: `{ "post": BoardPost }`
- 400 `invalid-body`: 형식 오류
- 422 `rejected`: `moderatePost()` 거부. `message`에 필터가 준 문구를 그대로 넣는다.
- 429 `rate-limited`: 같은 IP 해시가 60초 내 1건 초과, 또는 10분 내 5건 초과,
  또는 24시간 내 동일 `duplicateKey` 재등록.
- 403 `captcha-failed`: Turnstile 검증 실패.

### POST /api/posts/:id/report

신고. 익명, 인증 없음.

- 본문: `{ "reason": string }` (선택, 200자 이내)
- 200: `{ "ok": true }`
- 같은 IP 해시가 같은 글을 중복 신고하면 카운트를 올리지 않고 200을 반환한다.
- `report_count >= 3`이 되면 자동으로 `hidden_at`을 설정해 목록에서 감춘다
  (삭제가 아니라 숨김 — 소유자가 확인 후 되돌릴 수 있어야 한다).
- 429 `rate-limited`: 같은 IP 해시가 10분 내 10건 초과 신고.

### GET /api/admin/posts?filter=reported|hidden|all

소유자 전용. `Authorization: Bearer <ADMIN_TOKEN>`.

- 200: `{ "posts": (BoardPost & { hiddenAt: string | null, reports: {reason,createdAt}[] })[] }`
- 401 `unauthorized`: 토큰 불일치. 토큰은 Worker Secret으로만 보관한다.

### POST /api/admin/posts/:id/hide  ·  /unhide  ·  DELETE /api/admin/posts/:id

소유자 전용. 동일 인증.

- 200: `{ "ok": true }`

## D1 스키마

```sql
CREATE TABLE posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  body         TEXT    NOT NULL,
  author_tag   TEXT    NOT NULL,
  ip_hash      TEXT    NOT NULL,
  dup_key      TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  hidden_at    TEXT
);
CREATE INDEX idx_posts_created ON posts (id DESC);
CREATE INDEX idx_posts_iphash  ON posts (ip_hash, created_at);
CREATE INDEX idx_posts_dupkey  ON posts (dup_key, created_at);

CREATE TABLE reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason     TEXT,
  ip_hash    TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  UNIQUE (post_id, ip_hash)
);
```

## Worker 시크릿·바인딩

| 이름 | 종류 | 용도 |
| --- | --- | --- |
| `DB` | D1 바인딩 | 위 스키마 |
| `TURNSTILE_SECRET` | Secret | Turnstile 서버 검증 |
| `IP_SALT` | Secret | IP 해시용 고정 솔트(날짜와 조합해 일 단위 회전) |
| `ADMIN_TOKEN` | Secret | 관리 엔드포인트 인증 |
| `ALLOWED_ORIGIN` | 환경변수 | CORS 허용 오리진 |

프론트엔드에는 Turnstile **사이트 키**(공개값)만 들어간다. 시크릿은 절대 넣지 않는다.
