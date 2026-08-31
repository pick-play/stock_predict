import { jsonResponse, errorResponse } from '../lib/cors';
import { isAdmin } from '../lib/adminAuth';
import { hashIp } from '../lib/ipHash';
import { getClientIp } from '../lib/clientIp';
import { isLoginRateLimited } from '../lib/rateLimit';
import type { Env, BoardPost, BoardComment, PostRow, CommentRow } from '../types';

interface ReportRow {
  reason: string | null;
  created_at: string;
}

interface AdminPost extends BoardPost {
  hiddenAt: string | null;
  reports: { reason: string | null; createdAt: string }[];
}

export async function handleAdminGetPosts(
  request: Request,
  env: Env
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }

  const filter = new URL(request.url).searchParams.get('filter') ?? 'all';
  const where =
    filter === 'reported'
      ? 'WHERE report_count > 0'
      : filter === 'hidden'
      ? 'WHERE hidden_at IS NOT NULL'
      : '';

  const { results } = await env.DB.prepare(
    `SELECT id, body, author_tag, created_at, report_count, like_count, comment_count, hidden_at, member_id
     FROM posts ${where} ORDER BY id DESC`
  ).all<PostRow>();

  const posts: AdminPost[] = await Promise.all(
    results.map(async (row) => {
      const { results: reportRows } = await env.DB.prepare(
        'SELECT reason, created_at FROM reports WHERE post_id = ? ORDER BY created_at ASC'
      )
        .bind(row.id)
        .all<ReportRow>();

      return {
        id: String(row.id),
        body: row.body,
        authorTag: row.author_tag,
        isMember: row.member_id !== null,
        createdAt: row.created_at,
        reportCount: row.report_count,
        likeCount: row.like_count,
        commentCount: row.comment_count ?? 0,
        hiddenAt: row.hidden_at,
        reports: reportRows.map((r) => ({
          reason: r.reason,
          createdAt: r.created_at,
        })),
      };
    })
  );

  return jsonResponse({ posts }, 200, request, env);
}

export async function handleAdminHidePost(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }
  await env.DB.prepare('UPDATE posts SET hidden_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), Number(id))
    .run();
  return jsonResponse({ ok: true }, 200, request, env);
}

export async function handleAdminUnhidePost(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }
  await env.DB.prepare('UPDATE posts SET hidden_at = NULL WHERE id = ?')
    .bind(Number(id))
    .run();
  return jsonResponse({ ok: true }, 200, request, env);
}

export async function handleAdminDeletePost(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }
  await env.DB.prepare('DELETE FROM posts WHERE id = ?')
    .bind(Number(id))
    .run();
  return jsonResponse({ ok: true }, 200, request, env);
}

// ─── Admin comment endpoints ────────────────────────────────────────────────

interface AdminComment extends BoardComment {
  hiddenAt: string | null;
}

export async function handleAdminGetComments(
  request: Request,
  env: Env
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }

  const filter = new URL(request.url).searchParams.get('filter') ?? 'all';
  const where =
    filter === 'reported'
      ? 'WHERE report_count > 0'
      : filter === 'hidden'
      ? 'WHERE hidden_at IS NOT NULL'
      : '';

  const { results } = await env.DB.prepare(
    `SELECT id, post_id, body, author_tag, member_id, created_at, report_count, hidden_at
     FROM comments ${where} ORDER BY id DESC`
  ).all<CommentRow>();

  const comments: AdminComment[] = (results ?? []).map((row) => ({
    id: String(row.id),
    postId: String(row.post_id),
    body: row.body,
    authorTag: row.author_tag,
    createdAt: row.created_at,
    reportCount: row.report_count,
    hiddenAt: row.hidden_at,
  }));

  return jsonResponse({ comments }, 200, request, env);
}

export async function handleAdminDeleteComment(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  if (!isAdmin(request, env)) {
    return errorResponse('unauthorized', '인증이 필요합니다.', 401, request, env);
  }

  // Decrement the parent post's comment_count before deleting
  const comment = await env.DB.prepare('SELECT post_id FROM comments WHERE id = ?')
    .bind(Number(id))
    .first<{ post_id: number }>();

  await env.DB.prepare('DELETE FROM comments WHERE id = ?')
    .bind(Number(id))
    .run();

  if (comment) {
    await env.DB.prepare(
      'UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?'
    )
      .bind(comment.post_id)
      .run();
  }

  return jsonResponse({ ok: true }, 200, request, env);
}

/**
 * Exchanges the console password for the bearer token.
 *
 * Why this exists: the password is short and memorable, and a short secret is
 * only safe behind a counter. This endpoint is the single place it may be tried,
 * every attempt is logged against the IP hash before the check runs, and the
 * eleventh attempt in ten minutes is refused. The token it returns is long and
 * random, so the API itself never has to defend a guessable secret.
 *
 * Attempts share the login_attempts table with member logins. Deliberate: it is
 * a bare (ip_hash, created_at) log with no notion of what was attempted, and one
 * address hammering either door is the behaviour worth slowing down. The visible
 * consequence is that many failed member logins also delay the console from the
 * same address for ten minutes.
 */
export async function handleAdminLogin(
  request: Request,
  env: Env
): Promise<Response> {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    return errorResponse(
      'unavailable',
      '관리자 비밀번호가 설정되지 않았습니다.',
      503,
      request,
      env
    );
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === 'string') password = body.password;
  } catch {
    return errorResponse('invalid-body', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  // Logged before the check, so a wrong guess counts even if the response is fast.
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip_hash, created_at) VALUES (?, ?)'
  )
    .bind(ipHash, new Date().toISOString())
    .run();

  if (await isLoginRateLimited(env.DB, ipHash)) {
    return errorResponse(
      'rate-limited',
      '시도 횟수를 초과했습니다. 10분 후 다시 시도해주세요.',
      429,
      request,
      env
    );
  }

  if (!timingSafeEqual(password, expected)) {
    return errorResponse('unauthorized', '비밀번호가 올바르지 않습니다.', 401, request, env);
  }

  return jsonResponse({ token: env.ADMIN_TOKEN }, 200, request, env);
}

/**
 * Length-independent comparison.
 *
 * The attempt counter is the real defence here; this only removes the free hint
 * that an early-exit compare gives away about a prefix.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
