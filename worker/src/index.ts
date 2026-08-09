import { handleOptions, errorResponse } from './lib/cors';
import { handleGetPosts, handleCreatePost, handleGetPopularPosts } from './routes/posts';
import { handleLike } from './routes/like';
import { handleReport } from './routes/report';
import {
  handleAdminGetPosts,
  handleAdminHidePost,
  handleAdminUnhidePost,
  handleAdminDeletePost,
} from './routes/admin';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    const { pathname: path } = new URL(request.url);
    const { method } = request;

    // GET /api/posts/popular — must be matched before the :id routes
    if (method === 'GET' && path === '/api/posts/popular') {
      return handleGetPopularPosts(request, env);
    }

    // GET /api/posts
    if (method === 'GET' && path === '/api/posts') {
      return handleGetPosts(request, env);
    }

    // POST /api/posts
    if (method === 'POST' && path === '/api/posts') {
      return handleCreatePost(request, env);
    }

    // POST /api/posts/:id/report
    const reportMatch = path.match(/^\/api\/posts\/(\d+)\/report$/);
    if (method === 'POST' && reportMatch) {
      return handleReport(request, env, reportMatch[1]);
    }

    // POST /api/posts/:id/like
    const likeMatch = path.match(/^\/api\/posts\/(\d+)\/like$/);
    if (method === 'POST' && likeMatch) {
      return handleLike(request, env, likeMatch[1]);
    }

    // GET /api/admin/posts?filter=reported|hidden|all
    if (method === 'GET' && path === '/api/admin/posts') {
      return handleAdminGetPosts(request, env);
    }

    // POST /api/admin/posts/:id/hide
    const hideMatch = path.match(/^\/api\/admin\/posts\/(\d+)\/hide$/);
    if (method === 'POST' && hideMatch) {
      return handleAdminHidePost(request, env, hideMatch[1]);
    }

    // POST /api/admin/posts/:id/unhide
    const unhideMatch = path.match(/^\/api\/admin\/posts\/(\d+)\/unhide$/);
    if (method === 'POST' && unhideMatch) {
      return handleAdminUnhidePost(request, env, unhideMatch[1]);
    }

    // DELETE /api/admin/posts/:id
    const deleteMatch = path.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (method === 'DELETE' && deleteMatch) {
      return handleAdminDeletePost(request, env, deleteMatch[1]);
    }

    return errorResponse('not-found', '엔드포인트를 찾을 수 없습니다.', 404, request, env);
  },
};
