# stock-predict-board · Cloudflare Worker

익명 토론방 API 백엔드. `/docs/board-api.md` 계약을 구현한다.

## 구조

```
worker/
  src/
    index.ts              # 라우터 진입점
    types.ts              # Env 인터페이스, 공유 타입
    lib/
      cors.ts             # CORS 헤더·응답 헬퍼
      ipHash.ts           # HMAC-SHA256 일별 IP 해시
      rateLimit.ts        # D1 기반 레이트리밋
      turnstile.ts        # Cloudflare Turnstile 서버 검증
    routes/
      posts.ts            # GET·POST /api/posts
      report.ts           # POST /api/posts/:id/report
      admin.ts            # GET·POST·DELETE /api/admin/posts
  schema.sql              # D1 테이블 정의
  wrangler.toml           # Worker 설정 (실제 account_id, database_id 포함)
  .dev.vars.example       # 로컬 개발용 시크릿 템플릿
```

## 배포 체크리스트

### ✅ 이미 완료된 단계 (소유자가 다시 할 필요 없음)

| 항목 | 값 |
|---|---|
| Cloudflare 계정 연결 | `account_id = b695c192e7633379ca1f2cf5b5bfe416` |
| D1 데이터베이스 생성 | `stock-predict-board` / `f77f5931-cbfa-457a-aecf-35428e521e06` |
| Turnstile 위젯 생성 | 사이트 키: `0x4AAAAAAEK9nPy1fKA5ckGv` (프론트엔드 `VITE_TURNSTILE_SITE_KEY`) |
| `wrangler.toml` 실제 값 반영 | 이 저장소에 커밋됨 |

### 배포 전 1회 실행 (소유자)

```bash
cd worker

# 의존성 설치
npm install

# 프로덕션 D1에 스키마 적용 (테이블 없을 때 한 번만)
npm run db:init:remote

# 시크릿 3종 등록 (각 명령 실행 후 값 입력)
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put IP_SALT
npx wrangler secret put ADMIN_TOKEN
```

### Worker 배포

```bash
cd worker
npm run deploy
```

배포 후 Worker URL이 출력된다. 프론트엔드 환경변수에 반영:

```
VITE_BOARD_API_BASE=https://stock-predict-board.<your-subdomain>.workers.dev
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAEK9nPy1fKA5ckGv
```

## 로컬 개발

```bash
cd worker
cp .dev.vars.example .dev.vars   # 값 수정 후 사용
npm install
npm run db:init                  # 로컬 D1 초기화
npm run dev                      # http://localhost:8787
```

Turnstile 로컬 테스트 시크릿: `1x0000000000000000000000000000000AA` (항상 통과).  
`.dev.vars`는 gitignore에 포함되어 있어 커밋되지 않는다.

## 시크릿·바인딩 요약

| 이름 | 종류 | 설명 |
|---|---|---|
| `DB` | D1 바인딩 | 게시글·신고 저장 |
| `TURNSTILE_SECRET` | Secret | Turnstile 서버 검증 키 (절대 공개 금지) |
| `IP_SALT` | Secret | IP 해시용 솔트 (일별 회전에 조합) |
| `ADMIN_TOKEN` | Secret | 관리 엔드포인트 Bearer 토큰 |
| `ALLOWED_ORIGIN` | 환경변수 | CORS 허용 오리진 (`wrangler.toml` vars에 설정) |

## 보안 원칙

- 원본 IP는 저장하지 않는다. HMAC-SHA256 해시(일별 솔트)만 저장.
- Turnstile 시크릿은 Worker Secret에만 존재. 프론트엔드 코드에 없음.
- ADMIN_TOKEN은 Worker Secret에만 존재.
- 봇 허니팟: `website` 필드가 비어있지 않으면 저장 없이 201 응답(봇에게 실패를 알리지 않음).
