/**
 * Board API client.
 *
 * Base URL is injected via VITE_BOARD_API_BASE at build time.
 * When the env var is absent (default scenario: Worker not yet deployed),
 * isBoardConfigured is false and callers should show a "준비 중" state
 * instead of attempting any network request.
 */

import type { BoardListResponse, BoardPost, SubmitErrorKind } from "../../types/board";
import { BoardApiError } from "../../types/board";

export const BOARD_API_BASE = (
  (import.meta.env.VITE_BOARD_API_BASE as string | undefined) ?? ""
).replace(/\/$/, "");

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
      headers: { "Content-Type": "application/json; charset=utf-8" },
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
