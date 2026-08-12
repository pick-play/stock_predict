/**
 * Moderator API client.
 *
 * Every call carries the admin token as a bearer header — there is no session
 * cookie, so a 401 always means the password is wrong or has been rotated, and
 * the console can react to that one signal alone.
 *
 * The token is never put in a URL: query strings end up in logs and in the
 * browser's history, and this one is a credential.
 */

import { BOARD_API_BASE, isBoardConfigured } from "../board/api";
import type { BoardPost, BoardComment } from "../../types/board";
import type { ChatMessage } from "../../types/chat";

export class AdminApiError extends Error {
  readonly kind: "unauthorized" | "network" | "server";

  constructor(kind: "unauthorized" | "network" | "server", message: string) {
    super(message);
    this.name = "AdminApiError";
    this.kind = kind;
  }
}

export const isAdminConfigured = isBoardConfigured;

export type PostFilter = "reported" | "hidden" | "all";

export interface AdminPost extends BoardPost {
  hiddenAt: string | null;
  reports: { reason: string | null; createdAt: string }[];
}

export interface AdminComment extends BoardComment {
  hiddenAt: string | null;
}

async function call<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!isBoardConfigured) {
    throw new AdminApiError("server", "API 주소가 설정되지 않았습니다.");
  }

  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new AdminApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 401) {
    throw new AdminApiError("unauthorized", "비밀번호가 올바르지 않습니다.");
  }
  if (!res.ok) {
    throw new AdminApiError("server", `요청이 실패했습니다. (${res.status})`);
  }

  // 204 and empty bodies are legitimate for the mutating calls.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Trades the console password for the bearer token.
 *
 * The password never becomes the credential the API accepts. It is short and
 * memorable, and this is the only endpoint that will test it — attempt-limited
 * per IP, so guessing it costs more than a loop.
 */
export async function adminLogin(password: string): Promise<string> {
  if (!isBoardConfigured) {
    throw new AdminApiError("server", "API 주소가 설정되지 않았습니다.");
  }

  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new AdminApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 401) {
    throw new AdminApiError("unauthorized", "비밀번호가 올바르지 않습니다.");
  }
  if (res.status === 429) {
    throw new AdminApiError(
      "server",
      "시도 횟수를 초과했습니다. 10분 후 다시 시도해주세요.",
    );
  }
  if (!res.ok) {
    throw new AdminApiError("server", `확인에 실패했습니다. (${res.status})`);
  }

  const data = (await res.json()) as { token?: unknown };
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new AdminApiError("server", "서버 응답이 올바르지 않습니다.");
  }
  return data.token;
}

export function fetchAdminPosts(
  token: string,
  filter: PostFilter,
): Promise<{ posts: AdminPost[] }> {
  return call(token, `/api/admin/posts?filter=${filter}`);
}

export function hidePost(token: string, id: string): Promise<unknown> {
  return call(token, `/api/admin/posts/${id}/hide`, { method: "POST" });
}

export function unhidePost(token: string, id: string): Promise<unknown> {
  return call(token, `/api/admin/posts/${id}/unhide`, { method: "POST" });
}

export function deletePost(token: string, id: string): Promise<unknown> {
  return call(token, `/api/admin/posts/${id}`, { method: "DELETE" });
}

export function fetchAdminComments(
  token: string,
  filter: PostFilter,
): Promise<{ comments: AdminComment[] }> {
  return call(token, `/api/admin/comments?filter=${filter}`);
}

export function deleteComment(token: string, id: string): Promise<unknown> {
  return call(token, `/api/admin/comments/${id}`, { method: "DELETE" });
}

/** Uncached read — a moderator acts on the room as it is now. */
export function fetchChatLines(
  token: string,
  limit: number,
): Promise<{ messages: ChatMessage[]; participants: number }> {
  return call(token, `/api/chat/recent?limit=${limit}`);
}

export function deleteChatLines(
  token: string,
  target: { ids: string[] } | { handle: string },
): Promise<{ deleted: string[] }> {
  return call(token, "/api/chat/admin/delete", {
    method: "POST",
    body: JSON.stringify(target),
  });
}
