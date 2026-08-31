import { moderatePost, duplicateKey } from '../../../src/lib/moderation/filter';
import { hashIp } from '../lib/ipHash';
import { getClientIp } from '../lib/clientIp';
import { isPostRateLimited, isDuplicatePost } from '../lib/rateLimit';
import { verifyTurnstile } from '../lib/turnstile';
import { requireAuth } from '../lib/session';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env, BoardPost, PostRow } from '../types';

function rowToPost(row: PostRow): BoardPost {
  return {
    id: String(row.id),
    body: row.body,
    authorTag: row.author_tag,
    isMember: row.member_id !== null,
    createdAt: row.created_at,
    reportCount: row.report_count,
    likeCount: row.like_count,
    commentCount: row.comment_count ?? 0,
  };
}

export async function handleGetPosts(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Number.isNaN(limitRaw) || limitRaw <= 0 ? 20 : limitRaw, 50);

  const stmt = cursor
    ? env.DB.prepare(
        'SELECT id, body, author_tag, created_at, report_count, like_count, comment_count, member_id FROM posts WHERE hidden_at IS NULL AND id < ? ORDER BY id DESC LIMIT ?'
      ).bind(Number(cursor), limit + 1)
    : env.DB.prepare(
        'SELECT id, body, author_tag, created_at, report_count, like_count, comment_count, member_id FROM posts WHERE hidden_at IS NULL ORDER BY id DESC LIMIT ?'
      ).bind(limit + 1);

  const { results } = await stmt.all<PostRow>();

  let nextCursor: string | null = null;
  if (results.length > limit) {
    results.pop();
    nextCursor = String(results[results.length - 1].id);
  }

  return jsonResponse({ posts: results.map(rowToPost), nextCursor }, 200, request, env);
}

interface CreatePostBody {
  body?: unknown;
  turnstileToken?: unknown;
  website?: unknown;
}

export async function handleCreatePost(
  request: Request,
  env: Env
): Promise<Response> {
  let parsed: CreatePostBody;
  try {
    parsed = (await request.json()) as CreatePostBody;
  } catch {
    return errorResponse('invalid-body', '요청 형식이 올바르지 않습니다.', 400, request, env);
  }

  // Honeypot: non-empty website field → respond 201 without saving (bots are not told it failed)
  if (typeof parsed.website === 'string' && parsed.website !== '') {
    const fake: BoardPost = {
      id: '0',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      authorTag: '익명#0000',
      isMember: false,
      createdAt: new Date().toISOString(),
      reportCount: 0,
      likeCount: 0,
      commentCount: 0,
    };
    return jsonResponse({ post: fake }, 201, request, env);
  }

  if (typeof parsed.body !== 'string' || typeof parsed.turnstileToken !== 'string') {
    return errorResponse('invalid-body', '필수 항목이 누락되었습니다.', 400, request, env);
  }

  // Posting requires an account. Checked before moderation so a logged-out
  // writer is told to sign in rather than being handed a content error first.
  const authUser = await requireAuth(request, env);
  if (!authUser) {
    return errorResponse(
      'unauthorized',
      '글을 쓰려면 로그인해주세요.',
      401,
      request,
      env
    );
  }

  const rawBody = parsed.body;
  const token = parsed.turnstileToken;

  // Content moderation — Worker is the final authority (browser check is courtesy only)
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

  // Turnstile CAPTCHA verification
  const ip = getClientIp(request);
  const captchaOk = await verifyTurnstile(token, env, ip);
  if (!captchaOk) {
    return errorResponse(
      'captcha-failed',
      'CAPTCHA 검증에 실패했습니다. 다시 시도해주세요.',
      403,
      request,
      env
    );
  }

  const ipHash = await hashIp(ip, env.IP_SALT);

  // Rate limiting: 1/60 s or 5/10 min per IP hash
  if (await isPostRateLimited(env.DB, ipHash)) {
    return errorResponse(
      'rate-limited',
      '너무 자주 등록하셨습니다. 잠시 후 다시 시도해주세요.',
      429,
      request,
      env
    );
  }

  // Duplicate content check: same normalized body within 24 h
  const dupKey = duplicateKey(rawBody);
  if (await isDuplicatePost(env.DB, dupKey)) {
    return errorResponse(
      'rate-limited',
      '동일한 내용이 이미 등록되었습니다.',
      429,
      request,
      env
    );
  }

  // Every post now carries a nickname; the IP hash stays for rate limiting only.
  const authorTag = authUser.nickname;
  const memberId: number = authUser.id;

  const now = new Date().toISOString();

  const { meta } = await env.DB.prepare(
    'INSERT INTO posts (body, author_tag, ip_hash, dup_key, created_at, member_id) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(rawBody, authorTag, ipHash, dupKey, now, memberId)
    .run();

  const post: BoardPost = {
    id: String(meta.last_row_id),
    body: rawBody,
    authorTag,
    isMember: memberId !== null,
    createdAt: now,
    reportCount: 0,
    likeCount: 0,
    commentCount: 0,
  };

  return jsonResponse({ post }, 201, request, env);
}

/**
 * GET /api/posts/popular?limit=8
 *
 * Feeds the main-screen ticker. Ranks by likes and falls back to recency so a
 * brand-new board still has something to show. Scoped to the last 7 days so a
 * single old favourite cannot occupy the ticker forever.
 */
export async function handleGetPopularPosts(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '8', 10);
  const limit = Math.min(Number.isNaN(limitRaw) || limitRaw <= 0 ? 8 : limitRaw, 20);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { results } = await env.DB.prepare(
    `SELECT id, body, author_tag, created_at, report_count, like_count, comment_count, member_id
     FROM posts
     WHERE hidden_at IS NULL AND created_at >= ?
     ORDER BY like_count DESC, id DESC
     LIMIT ?`
  )
    .bind(since, limit)
    .all<PostRow>();

  return jsonResponse({ posts: (results ?? []).map(rowToPost) }, 200, request, env);
}
