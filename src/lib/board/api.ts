/**
 * Board API client.
 *
 * Base URL is injected via VITE_BOARD_API_BASE at build time.
 * When the env var is absent (default scenario: Worker not yet deployed),
 * isBoardConfigured is false and callers should show a "준비 중" state
 * instead of attempting any network request.
 */

import type { BoardListResponse, BoardPost, BoardComment, CommentListResponse, LikeResponse, SubmitErrorKind } from "../../types/board";
import { BoardApiError } from "../../types/board";
import { resolveApiBase } from "../apiBase";

export const BOARD_API_BASE = resolveApiBase(
  import.meta.env.VITE_BOARD_API_BASE as string | undefined
);

export const isBoardConfigured = BOARD_API_BASE.length > 0;

// ─── Fetch posts ──────────────────────────────────────────────────────────────

interface FetchPostsOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchPosts(
  opts: FetchPostsOptions = {}
): Promise<BoardListResponse> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = `${BOARD_API_BASE}/api/posts${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal });
  } catch {
    throw new BoardApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as
      | { error?: string; message?: string }
      | null;
    throw new BoardApiError(
      "network",
      body?.message ?? "목록을 불러올 수 없습니다."
    );
  }

  return res.json() as Promise<BoardListResponse>;
}

// ─── Submit post ──────────────────────────────────────────────────────────────

interface SubmitPostOptions {
  body: string;
  turnstileToken: string;
  /** Bearer token for logged-in posts. When supplied, the server uses the
   *  member's nickname as authorTag and sets isMember: true. */
  authToken?: string;
  signal?: AbortSignal;
}

const ERROR_KIND_MAP: Partial<Record<string, SubmitErrorKind>> = {
  "invalid-body": "invalid-body",
  rejected: "rejected",
  "rate-limited": "rate-limited",
  "captcha-failed": "captcha-failed",
};

export async function submitPost(opts: SubmitPostOptions): Promise<BoardPost> {
  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
      },
      body: JSON.stringify({
        body: opts.body,
        turnstileToken: opts.turnstileToken,
        // Honeypot — real users always send empty string; bots may fill it.
        // The value is never read here: the server owns the actual check.
        website: "",
      }),
      signal: opts.signal,
    });
  } catch {
    throw new BoardApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 201) {
    const data = (await res.json()) as { post: BoardPost };
    return data.post;
  }

  const errBody = await res.json().catch(() => null) as
    | { error?: string; message?: string }
    | null;
  const kind: SubmitErrorKind =
    ERROR_KIND_MAP[errBody?.error ?? ""] ?? "network";
  throw new BoardApiError(kind, errBody?.message ?? "등록할 수 없습니다.");
}

// ─── Popular posts (ticker) ───────────────────────────────────────────────────

interface FetchPopularOptions {
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchPopularPosts(
  opts: FetchPopularOptions = {}
): Promise<BoardPost[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = `${BOARD_API_BASE}/api/posts/popular${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal });
  } catch {
    throw new BoardApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as
      | { message?: string }
      | null;
    throw new BoardApiError(
      "network",
      body?.message ?? "인기 글 목록을 불러올 수 없습니다."
    );
  }

  const data = (await res.json()) as { posts: BoardPost[] };
  return data.posts;
}

// ─── Like post ────────────────────────────────────────────────────────────────

export async function likePost(
  id: string,
  signal?: AbortSignal
): Promise<LikeResponse> {
  let res: Response;
  try {
    res = await fetch(
      `${BOARD_API_BASE}/api/posts/${encodeURIComponent(id)}/like`,
      { method: "POST", signal }
    );
  } catch {
    throw new BoardApiError("network", "공감 처리에 실패했습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as
      | { message?: string }
      | null;
    throw new BoardApiError(
      "network",
      body?.message ?? "공감 처리에 실패했습니다."
    );
  }

  return res.json() as Promise<LikeResponse>;
}

// ─── Fetch comments ───────────────────────────────────────────────────────────

interface FetchCommentsOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchComments(
  postId: string,
  opts: FetchCommentsOptions = {}
): Promise<CommentListResponse> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = `${BOARD_API_BASE}/api/posts/${encodeURIComponent(postId)}/comments${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal });
  } catch {
    throw new BoardApiError("network", "댓글을 불러올 수 없습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as
      | { message?: string }
      | null;
    throw new BoardApiError(
      "network",
      body?.message ?? "댓글을 불러올 수 없습니다."
    );
  }

  return res.json() as Promise<CommentListResponse>;
}

// ─── Submit comment ───────────────────────────────────────────────────────────

interface SubmitCommentOptions {
  body: string;
  authToken: string;
  signal?: AbortSignal;
}

export async function submitComment(
  postId: string,
  opts: SubmitCommentOptions
): Promise<BoardComment> {
  let res: Response;
  try {
    res = await fetch(
      `${BOARD_API_BASE}/api/posts/${encodeURIComponent(postId)}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${opts.authToken}`,
        },
        body: JSON.stringify({ body: opts.body }),
        signal: opts.signal,
      }
    );
  } catch {
    throw new BoardApiError("network", "네트워크 연결을 확인해주세요.");
  }

  if (res.status === 201) {
    const data = (await res.json()) as { comment: BoardComment };
    return data.comment;
  }

  const errBody = await res.json().catch(() => null) as
    | { error?: string; message?: string }
    | null;
  const kind: SubmitErrorKind =
    ERROR_KIND_MAP[errBody?.error ?? ""] ?? "network";
  throw new BoardApiError(kind, errBody?.message ?? "댓글을 등록할 수 없습니다.");
}

// ─── Report comment ───────────────────────────────────────────────────────────

export async function reportComment(commentId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${BOARD_API_BASE}/api/comments/${encodeURIComponent(commentId)}/report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ reason: "" }),
      }
    );
  } catch {
    throw new BoardApiError("network", "신고를 처리할 수 없습니다.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as
      | { message?: string }
      | null;
    throw new BoardApiError(
      "network",
      body?.message ?? "신고를 처리할 수 없습니다."
    );
  }
}

// ─── Report post ──────────────────────────────────────────────────────────────

export async function reportPost(id: string, reason: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BOARD_API_BASE}/api/posts/${encodeURIComponent(id)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ reason: reason.slice(0, 200) }),
    });
  } catch {
    throw new BoardApiError("network", "신고를 처리할 수 없습니다.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as
      | { message?: string }
      | null;
    throw new BoardApiError("network", body?.message ?? "신고를 처리할 수 없습니다.");
  }
}
