import { hashIp } from '../lib/ipHash';
import { getClientIp } from '../lib/clientIp';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env } from '../types';

/**
 * POST /api/posts/:id/like
 *
 * One like per post per daily IP hash, enforced by UNIQUE (post_id, ip_hash).
 * A repeat press is not an error — it returns the current count so the button
 * simply settles into its liked state. Likes are never removed: without
 * accounts there is no way to tell an undo from someone else's device.
 */
export async function handleLike(
  request: Request,
  env: Env,
  postId: string
): Promise<Response> {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  const post = await env.DB.prepare(
    'SELECT like_count FROM posts WHERE id = ? AND hidden_at IS NULL'
  )
    .bind(id)
    .first<{ like_count: number }>();

  if (!post) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  const ipHash = await hashIp(getClientIp(request), env.IP_SALT);
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      'INSERT INTO likes (post_id, ip_hash, created_at) VALUES (?, ?, ?)'
    )
      .bind(id, ipHash, now)
      .run();
  } catch {
    // UNIQUE violation: already liked from this IP hash today.
    return jsonResponse(
      { ok: true, likeCount: post.like_count, alreadyLiked: true },
      200,
      request,
      env
    );
  }

  await env.DB.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?')
    .bind(id)
    .run();

  return jsonResponse(
    { ok: true, likeCount: post.like_count + 1, alreadyLiked: false },
    200,
    request,
    env
  );
}
