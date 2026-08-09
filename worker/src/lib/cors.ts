import type { Env } from '../types';

function getAllowedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get('Origin') ?? '';
  if (origin === env.ALLOWED_ORIGIN || origin === 'http://localhost:5173') {
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
