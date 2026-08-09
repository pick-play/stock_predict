import { requireAuth } from '../lib/session';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env, PostRow } from '../types';

// ─── GET /api/me/posts ─────────────────────────────────────────────────────

export async function handleGetMyPosts(request: Request, env: Env): Promise<Response> {
  const user = await requireAuth(request, env);
  if (!user) {
    return errorResponse(
      'unauthorized',
      '인증이 필요하거나 세션이 만료되었습니다.',
      401,
      request,
      env
    );
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Number.isNaN(limitRaw) || limitRaw <= 0 ? 20 : limitRaw, 50);

  const stmt = cursor
    ? env.DB.prepare(
        `SELECT id, body, author_tag, created_at, report_count, like_count, hidden_at
         FROM posts WHERE member_id = ? AND id < ? ORDER BY id DESC LIMIT ?`
      ).bind(user.id, Number(cursor), limit + 1)
    : env.DB.prepare(
        `SELECT id, body, author_tag, created_at, report_count, like_count, hidden_at
         FROM posts WHERE member_id = ? ORDER BY id DESC LIMIT ?`
      ).bind(user.id, limit + 1);

  const { results } = await stmt.all<PostRow>();

  let nextCursor: string | null = null;
  if (results.length > limit) {
    results.pop();
    nextCursor = String(results[results.length - 1].id);
  }

  const posts = results.map((row) => ({
    id: String(row.id),
    body: row.body,
    authorTag: row.author_tag,
    isMember: true,
    createdAt: row.created_at,
    reportCount: row.report_count,
    likeCount: row.like_count,
    hiddenAt: row.hidden_at,
  }));

  return jsonResponse({ posts, nextCursor }, 200, request, env);
}
