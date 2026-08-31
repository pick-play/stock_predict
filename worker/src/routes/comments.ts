import { moderatePost } from '../../../src/lib/moderation/filter';
import { hashIp } from '../lib/ipHash';
import { getClientIp } from '../lib/clientIp';
import { isCommentRateLimited, isCommentReportRateLimited } from '../lib/rateLimit';
import { requireAuth } from '../lib/session';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env, BoardComment, CommentRow } from '../types';

function rowToComment(row: CommentRow): BoardComment {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    body: row.body,
    authorTag: row.author_tag,
    createdAt: row.created_at,
    reportCount: row.report_count,
  };
}

// ─── GET /api/posts/:id/comments ───────────────────────────────────────────

export async function handleGetComments(
  request: Request,
  env: Env,
  postId: string
): Promise<Response> {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  // Verify post exists and is not hidden
  const post = await env.DB.prepare(
    'SELECT id FROM posts WHERE id = ? AND hidden_at IS NULL'
  )
    .bind(id)
    .first<{ id: number }>();

  if (!post) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Number.isNaN(limitRaw) || limitRaw <= 0 ? 20 : limitRaw, 50);

  const stmt = cursor
    ? env.DB.prepare(
        'SELECT id, post_id, body, author_tag, member_id, created_at, report_count, hidden_at FROM comments WHERE post_id = ? AND hidden_at IS NULL AND id > ? ORDER BY id ASC LIMIT ?'
      ).bind(id, Number(cursor), limit + 1)
    : env.DB.prepare(
        'SELECT id, post_id, body, author_tag, member_id, created_at, report_count, hidden_at FROM comments WHERE post_id = ? AND hidden_at IS NULL ORDER BY id ASC LIMIT ?'
      ).bind(id, limit + 1);

  const { results } = await stmt.all<CommentRow>();

  let nextCursor: string | null = null;
  if (results.length > limit) {
    results.pop();
    nextCursor = String(results[results.length - 1].id);
  }

  return jsonResponse({ comments: results.map(rowToComment), nextCursor }, 200, request, env);
}

// ─── POST /api/posts/:id/comments ──────────────────────────────────────────

interface CreateCommentBody {
  body?: unknown;
}

export async function handleCreateComment(
  request: Request,
  env: Env,
  postId: string
): Promise<Response> {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  // Auth is required for comments
  const authUser = await requireAuth(request, env);
  if (!authUser) {
    return errorResponse(
      'unauthorized',
      '댓글을 쓰려면 로그인해주세요.',
      401,
      request,
      env
    );
  }

  let parsed: CreateCommentBody;
  try {
    parsed = (await request.json()) as CreateCommentBody;
  } catch {
    return errorResponse('invalid-body', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  if (typeof parsed.body !== 'string') {
    return errorResponse('invalid-body', '필수 항목이 누락되었습니다.', 400, request, env);
  }

  const rawBody = parsed.body;

  // Verify post exists and is not hidden
  const post = await env.DB.prepare(
    'SELECT id FROM posts WHERE id = ? AND hidden_at IS NULL'
  )
    .bind(id)
    .first<{ id: number }>();

  if (!post) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  // Content moderation — same function as posts, Worker is the final authority
  const modResult = moderatePost(rawBody);
  if (!modResult.ok) {
    return errorResponse(
      'rejected',
      modResult.message ?? '등록할 수 없는 내용입니다.',
      422,
      request,
      env
    );
  }

  // Rate limiting: 1/20 s or 15/10 min per member
  if (await isCommentRateLimited(env.DB, authUser.id)) {
    return errorResponse(
      'rate-limited',
      '너무 자주 댓글을 작성하셨습니다. 잠시 후 다시 시도해주세요.',
      429,
      request,
      env
    );
  }

  const now = new Date().toISOString();
  const authorTag = authUser.nickname;

  const { meta } = await env.DB.prepare(
    'INSERT INTO comments (post_id, body, author_tag, member_id, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, rawBody, authorTag, authUser.id, now)
    .run();

  // Increment comment_count on the parent post
  await env.DB.prepare(
    'UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?'
  )
    .bind(id)
    .run();

  const comment: BoardComment = {
    id: String(meta.last_row_id),
    postId: String(id),
    body: rawBody,
    authorTag,
    createdAt: now,
    reportCount: 0,
  };

  return jsonResponse({ comment }, 201, request, env);
}

// ─── POST /api/comments/:id/report ─────────────────────────────────────────

export async function handleReportComment(
  request: Request,
  env: Env,
  commentId: string
): Promise<Response> {
  const id = Number(commentId);
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse('not-found', '댓글을 찾을 수 없습니다.', 404, request, env);
  }

  // reason is optional; accept empty body gracefully
  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === 'string') {
      reason = body.reason.slice(0, 200);
    }
  } catch {
    // no body or invalid JSON — fine, reason stays null
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  // Rate limit: 10 comment reports per 10 min per IP hash
  if (await isCommentReportRateLimited(env.DB, ipHash)) {
    return errorResponse(
      'rate-limited',
      '너무 많이 신고하셨습니다. 잠시 후 다시 시도해주세요.',
      429,
      request,
      env
    );
  }

  // Same rule as post reports: the target must be a visible comment, or the
  // reports table fills with rows about ids nobody can act on. Hidden 404s
  // like missing — hidden means invisible everywhere.
  const target = await env.DB.prepare(
    'SELECT id FROM comments WHERE id = ? AND hidden_at IS NULL'
  )
    .bind(id)
    .first<{ id: number }>();

  if (!target) {
    return errorResponse('not-found', '댓글을 찾을 수 없습니다.', 404, request, env);
  }

  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      'INSERT INTO comment_reports (comment_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(id, reason, ipHash, now)
      .run();
  } catch {
    // UNIQUE (comment_id, ip_hash) violation = duplicate report. Return 200 silently.
    return jsonResponse({ ok: true }, 200, request, env);
  }

  // Increment report_count; auto-hide when it reaches 3.
  await env.DB.prepare(
    `UPDATE comments
     SET report_count = report_count + 1,
         hidden_at = CASE
           WHEN report_count + 1 >= 3 AND hidden_at IS NULL THEN ?
           ELSE hidden_at
         END
     WHERE id = ?`
  )
    .bind(now, id)
    .run();

  return jsonResponse({ ok: true }, 200, request, env);
}
