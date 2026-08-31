import type { Env } from '../types';

/**
 * ALLOWED_ORIGIN holds a comma-separated list because the site answers on both
 * the apex and the www host. Only an exact match is echoed back — a wildcard
 * would let any page call the board with a logged-in reader's bearer token.
 *
 * No localhost entry, by §28 of CLAUDE.md: local dev goes through the Vite
 * proxy (vite.config.ts `/api` → Worker), which forwards requests under the
 * page's own origin, so the production allowlist is all dev ever needs.
 */
function getAllowedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowed.includes(origin)) {
    return origin;
  }
  return '';
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function handleOptions(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      'Access-Control-Max-Age': '86400',
    },
  });
}

export function jsonResponse(
  data: unknown,
  status: number,
  request: Request,
  env: Env
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  request: Request,
  env: Env
): Response {
  return jsonResponse({ error: code, message }, status, request, env);
}
