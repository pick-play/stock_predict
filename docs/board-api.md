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
  authorTag: string;     // 로그인 글이면 닉네임, 아니면 "익명#a3f2"(IP해시+일자솔트 파생, 날마다 바뀜)
  isMember: boolean;     // true면 authorTag가 닉네임 — UI가 익명과 구분해 표시한다
  createdAt: string;     // ISO 8601 UTC
  reportCount: number;
  likeCount: number;
}
```

## 엔드포인트

## 계정 (선택 사항)

로그인은 선택이다. 로그인하지 않아도 지금처럼 익명으로 글을 쓸 수 있고,
로그인하면 닉네임으로 글이 표시되며 자기가 쓴 글을 모아 볼 수 있다.

수집하는 정보는 **닉네임과 비밀번호뿐이다.** 이메일·전화번호·이름을 묻지 않는다.
그 대가로 **비밀번호를 잊으면 복구 수단이 없다.** 그래서 가입 시 복구 코드를
한 번만 보여주고, 그 코드로만 비밀번호를 재설정할 수 있게 한다.

비밀번호 처리:
- 브라우저가 `src/lib/auth/deriveAuthKey.ts`로 PBKDF2(210,000회) 스트레칭한 값(`authKey`)만 전송한다. 원문 비밀번호는 서버로 가지 않는다.
- 서버는 `authKey`를 사용자별 salt와 `PASSWORD_PEPPER` 시크릿으로 HMAC-SHA256 해싱해 저장한다(`worker/src/lib/password.ts`).
- 세션은 불투명 토큰(32바이트)이며 서버에는 SHA-256 해시만 저장한다. 브라우저는 `Authorization: Bearer <token>`으로 보낸다.

닉네임 규칙:
- 2~16자, 한글·영문·숫자·밑줄만 허용
- 대소문자 무시 중복 금지(`nickname_normalized` UNIQUE)
- `moderatePost()` 검열 통과 필수
- 예약어 금지: `관리자`, `운영자`, `admin`, `administrator`, `운영진`, `공지`, `익명`

### POST /api/auth/signup

- 본문: `{ "nickname": string, "authKey": string(64 hex), "turnstileToken": string }`
- 201: `{ "token": string, "nickname": string, "recoveryCode": string }`
  ※ `recoveryCode`는 이때 단 한 번만 반환된다. 서버는 해시만 보관한다.
- 409 `nickname-taken` / 422 `invalid-nickname` / 403 `captcha-failed`
- 429 `rate-limited`: 같은 IP 해시가 24시간 내 3개 초과 가입

### POST /api/auth/login

- 본문: `{ "nickname": string, "authKey": string }`
- 200: `{ "token": string, "nickname": string }`
- 401 `invalid-credentials`: 닉네임이 없든 비밀번호가 틀리든 **같은 응답**을 준다(계정 존재 여부를 알려주지 않는다).
- 429 `rate-limited`: 같은 IP 해시가 10분 내 10회 초과 시도

### POST /api/auth/logout
- 인증 필요. 200: `{ "ok": true }` — 해당 세션만 폐기한다.

### GET /api/auth/me
- 인증 필요. 200: `{ "nickname": string, "createdAt": string, "postCount": number }`
- 401 `unauthorized`: 토큰이 없거나 만료됨(30일).

### POST /api/auth/reset-password
- 본문: `{ "nickname": string, "recoveryCode": string, "authKey": string }`
- 200: `{ "ok": true }` — 기존 세션을 모두 폐기한다.
- 401 `invalid-recovery`: 닉네임·코드 불일치(구분하지 않는다).

### GET /api/me/posts?cursor=&limit=

- 인증 필요. 자기 글만 최신순. 숨김 처리된 자기 글도 포함하되 `hiddenAt`을 채워 보낸다.
- 200: `{ "posts": (BoardPost & { hiddenAt: string | null })[], "nextCursor": string | null }`

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

### GET /api/posts/popular

메인 화면 티커용. 최근 7일 글을 공감 수 내림차순, 동률이면 최신순으로 반환한다.
공감이 아직 없는 새 게시판에서도 최신 글이 채워지도록 설계됐다.

- 쿼리: `limit`(선택, 기본 8, 최대 20)
- 200: `{ "posts": BoardPost[] }`  ※ `nextCursor` 없음
- 숨김 글 제외.

### POST /api/posts/:id/like

공감. 익명, 인증 없음.

- 200: `{ "ok": true, "likeCount": number, "alreadyLiked": boolean }`
- 같은 IP 해시가 같은 글에 다시 누르면 카운트를 올리지 않고 `alreadyLiked: true`로 200을 반환한다(오류 아님).
- 공감 취소는 없다. 계정이 없으면 취소와 타인의 기기를 구분할 수 없기 때문이다.
- 404 `not-found`: 없는 글이거나 숨김 처리된 글.

## 댓글

댓글도 글과 같은 규칙을 따른다: **작성은 로그인 필수**, 읽기는 누구나.
검열·도배 차단·신고 흐름 모두 글과 동일하며, `moderatePost()`를 공유한다.

```ts
interface BoardComment {
  id: string;
  postId: string;
  body: string;          // 최대 500자
  authorTag: string;     // 닉네임
  createdAt: string;
  reportCount: number;
}
```

`BoardPost`에 `commentCount: number`가 추가된다.

### GET /api/posts/:id/comments?cursor=&limit=
- 오래된 순(대화 흐름). 기본 20, 최대 50. 숨김 댓글 제외.
- 200: `{ "comments": BoardComment[], "nextCursor": string | null }`

### POST /api/posts/:id/comments
- **인증 필요.** 본문: `{ "body": string }` (캡차는 요구하지 않는다 — 이미 로그인 계정이고 도배 제한이 걸린다)
- 201: `{ "comment": BoardComment }`
- 401 `unauthorized` / 404 `not-found`(없거나 숨김 처리된 글) / 422 `rejected`(검열)
- 429 `rate-limited`: 같은 계정이 20초 내 1건 초과, 또는 10분 내 15건 초과

### POST /api/comments/:id/report
- 글 신고와 동일. 같은 IP 해시 중복 신고는 200으로 무시. `report_count >= 3`이면 자동 숨김.

### 관리
- `GET /api/admin/comments?filter=reported|hidden|all`, `DELETE /api/admin/comments/:id` — 글 관리와 동일한 Bearer 인증.

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
