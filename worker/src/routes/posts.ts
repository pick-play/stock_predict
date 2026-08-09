import { moderatePost, duplicateKey } from '../../../src/lib/moderation/filter';
import { hashIp, toAuthorTag } from '../lib/ipHash';
import { isPostRateLimited, isDuplicatePost } from '../lib/rateLimit';
import { verifyTurnstile } from '../lib/turnstile';
import { jsonResponse, errorResponse } from '../lib/cors';
import type { Env, BoardPost, PostRow } from '../types';

function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    '0.0.0.0'
  );
}

function rowToPost(row: PostRow): BoardPost {
  return {
    id: String(row.id),
    body: row.body,
    authorTag: row.author_tag,
    createdAt: row.created_at,
    reportCount: row.report_count,
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
        'SELECT id, body, author_tag, created_at, report_count FROM posts WHERE hidden_at IS NULL AND id < ? ORDER BY id DESC LIMIT ?'
      ).bind(Number(cursor), limit + 1)
    : env.DB.prepare(
        'SELECT id, body, author_tag, created_at, report_count FROM posts WHERE hidden_at IS NULL ORDER BY id DESC LIMIT ?'
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
      createdAt: new Date().toISOString(),
      reportCount: 0,
    };
    return jsonResponse({ post: fake }, 201, request, env);
  }

  if (typeof parsed.body !== 'string' || typeof parsed.turnstileToken !== 'string') {
    return errorResponse('invalid-body', '필수 항목이 누락되었습니다.', 400, request, env);
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
  const captchaOk = await verifyTurnstile(token, env.TURNSTILE_SECRET, ip);
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

  const now = new Date().toISOString();
  const authorTag = toAuthorTag(ipHash);

  const { meta } = await env.DB.prepare(
    'INSERT INTO posts (body, author_tag, ip_hash, dup_key, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(rawBody, authorTag, ipHash, dupKey, now)
    .run();

  const post: BoardPost = {
    id: String(meta.last_row_id),
    body: rawBody,
    authorTag,
    createdAt: now,
    reportCount: 0,
  };

  return jsonResponse({ post }, 201, request, env);
}
