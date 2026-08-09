import { hashIp } from '../lib/ipHash';
import { isReportRateLimited } from '../lib/rateLimit';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env } from '../types';

function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    '0.0.0.0'
  );
}

export async function handleReport(
  request: Request,
  env: Env,
  postId: string
): Promise<Response> {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse('not-found', '게시글을 찾을 수 없습니다.', 404, request, env);
  }

  // reason is optional; accept empty body gracefully
  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === 'string') {
      reason = body.reason.slice(0, 200);
    }
  } catch {
    // no body or invalid JSON — that is fine, reason stays null
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  // Rate limit: 10 reports per 10 min per IP hash
  if (await isReportRateLimited(env.DB, ipHash)) {
    return errorResponse(
      'rate-limited',
      '너무 많이 신고하셨습니다. 잠시 후 다시 시도해주세요.',
      429,
      request,
      env
    );
  }

  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      'INSERT INTO reports (post_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(id, reason, ipHash, now)
      .run();
  } catch {
    // UNIQUE (post_id, ip_hash) violation = duplicate report from same IP.
    // Per spec: do not increment count, return 200 silently.
    return jsonResponse({ ok: true }, 200, request, env);
  }

  // Increment report_count; auto-hide when it reaches 3.
  await env.DB.prepare(
    `UPDATE posts
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
