import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env, BoardPost, BoardComment, PostRow, CommentRow } from '../types';

function isAdmin(request: Request, env: Env): boolean {
  return request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;
}

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
