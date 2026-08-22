import { handleOptions, errorResponse } from './lib/cors';
import { handleGetPosts, handleCreatePost, handleGetPopularPosts } from './routes/posts';
import { handleLike } from './routes/like';
import { handleReport } from './routes/report';
import {
  handleAdminLogin,
  handleAdminGetPosts,
  handleAdminHidePost,
  handleAdminUnhidePost,
  handleAdminDeletePost,
  handleAdminGetComments,
  handleAdminDeleteComment,
} from './routes/admin';
import {
  handleGetComments,
  handleCreateComment,
  handleReportComment,
} from './routes/comments';
import {
  handleSignup,
  handleLogin,
  handleLogout,
  handleGetMe,
  handleResetPassword,
} from './routes/auth';
import { handleGetMyPosts } from './routes/me';
import { handleGetMarkets } from './routes/markets';
import {
  handleChatTicket,
  handleChatRoom,
  handleChatRecent,
  handleChatPresence,
  handleChatCount,
  handleChatAdminDelete,
} from './routes/chat';
import type { Env } from './types';

// The Durable Object class has to be exported from the Worker entry module for
// the runtime to bind it. See worker/src/chatRoom.ts for why the chat room is a
// Durable Object and the board is not.
export { ChatRoom } from './chatRoom';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    const { pathname: path } = new URL(request.url);
    const { method } = request;

    // GET /api/markets — ticker tape quotes (proxies Yahoo, which sends no CORS)
    if (method === 'GET' && path === '/api/markets') {
      return handleGetMarkets(request, env);
    }

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

    // POST /api/admin/login — short password traded for the bearer token
    if (method === 'POST' && path === '/api/admin/login') {
      return handleAdminLogin(request, env);
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

    // POST /api/auth/signup
    if (method === 'POST' && path === '/api/auth/signup') {
      return handleSignup(request, env);
    }

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      return handleLogin(request, env);
    }

    // POST /api/auth/logout
    if (method === 'POST' && path === '/api/auth/logout') {
      return handleLogout(request, env);
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      return handleGetMe(request, env);
    }

    // POST /api/auth/reset-password
    if (method === 'POST' && path === '/api/auth/reset-password') {
      return handleResetPassword(request, env);
    }

    // GET /api/me/posts
    if (method === 'GET' && path === '/api/me/posts') {
      return handleGetMyPosts(request, env);
    }

    // GET /api/posts/:id/comments
    const commentsMatch = path.match(/^\/api\/posts\/(\d+)\/comments$/);
    if (method === 'GET' && commentsMatch) {
      return handleGetComments(request, env, commentsMatch[1]);
    }

    // POST /api/posts/:id/comments
    if (method === 'POST' && commentsMatch) {
      return handleCreateComment(request, env, commentsMatch[1]);
    }

    // POST /api/comments/:id/report
    const commentReportMatch = path.match(/^\/api\/comments\/(\d+)\/report$/);
    if (method === 'POST' && commentReportMatch) {
      return handleReportComment(request, env, commentReportMatch[1]);
    }

    // GET /api/admin/comments?filter=reported|hidden|all
    if (method === 'GET' && path === '/api/admin/comments') {
      return handleAdminGetComments(request, env);
    }

    // DELETE /api/admin/comments/:id
    const adminCommentDeleteMatch = path.match(/^\/api\/admin\/comments\/(\d+)$/);
    if (method === 'DELETE' && adminCommentDeleteMatch) {
      return handleAdminDeleteComment(request, env, adminCommentDeleteMatch[1]);
    }

    // POST /api/chat/ticket — Turnstile check traded for a short-lived join ticket
    if (method === 'POST' && path === '/api/chat/ticket') {
      return handleChatTicket(request, env);
    }

    // GET /api/chat/room — WebSocket upgrade proxied to the ChatRoom Durable Object
    if (method === 'GET' && path === '/api/chat/room') {
      return handleChatRoom(request, env);
    }

    // POST /api/chat/admin/delete — moderator removes chat lines
    if (method === 'POST' && path === '/api/chat/admin/delete') {
      return handleChatAdminDelete(request, env);
    }

    /*
     * POST /api/chat/presence — "somebody is on the site".
     *
     * POST rather than GET because it changes what the room reports, and a GET
     * that mutates is the kind of thing a prefetcher fires on its own.
     */
    if (method === 'POST' && path === '/api/chat/presence') {
      return handleChatPresence(request, env);
    }

    // GET /api/chat/count — the site headcount alone, cached, a few bytes
    if (method === 'GET' && path === '/api/chat/count') {
      return handleChatCount(request, env);
    }

    // GET /api/chat/recent — read-only transcript preview for the dashboard
    if (method === 'GET' && path === '/api/chat/recent') {
      return handleChatRecent(request, env);
    }

    return errorResponse('not-found', '엔드포인트를 찾을 수 없습니다.', 404, request, env);
  },
};
