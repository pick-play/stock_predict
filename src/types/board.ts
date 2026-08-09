/**
 * Board types shared between UI components and the API client.
 * Mirrors the contract defined in docs/board-api.md.
 */

export interface BoardPost {
  id: string;
  /** Plain text — caller must render as text, never set as innerHTML. */
  body: string;
  authorTag: string;
  /** true when authorTag is a member nickname; false for anonymous tags. */
  isMember: boolean;
  createdAt: string;
  reportCount: number;
  likeCount: number;
  commentCount: number;
}

/** Single comment on a post. Writing requires login; reading is public. */
export interface BoardComment {
  id: string;
  postId: string;
  /** Plain text — caller must render as text, never set as innerHTML. */
  body: string;
  /** Always a member nickname — comments require login. */
  authorTag: string;
  createdAt: string;
  reportCount: number;
}

export interface CommentListResponse {
  comments: BoardComment[];
  nextCursor: string | null;
}

/** Board post with optional hidden timestamp — returned by GET /api/me/posts. */
export type MyPost = BoardPost & { hiddenAt: string | null };

export interface LikeResponse {
  ok: boolean;
  likeCount: number;
  alreadyLiked: boolean;
}

export interface BoardListResponse {
  posts: BoardPost[];
  nextCursor: string | null;
}

export interface MyPostsResponse {
  posts: MyPost[];
  nextCursor: string | null;
}

export type SubmitErrorKind =
  | "invalid-body"
  | "rejected"
  | "rate-limited"
  | "captcha-failed"
  | "network";

/** Typed error thrown by board API calls. */
export class BoardApiError extends Error {
  readonly kind: SubmitErrorKind;

  constructor(kind: SubmitErrorKind, message: string) {
    super(message);
    this.name = "BoardApiError";
    this.kind = kind;
  }
}

// ── Auth types ────────────────────────────────────────────────────────────────

export interface AuthSession {
  token: string;
  nickname: string;
}

export interface SignupResult {
  token: string;
  nickname: string;
  /** Returned exactly once. The server stores only a hash. */
  recoveryCode: string;
}

export interface AuthUser {
  nickname: string;
  createdAt: string;
  postCount: number;
}

export type AuthErrorKind =
  | "nickname-taken"
  | "invalid-nickname"
  | "captcha-failed"
  | "invalid-credentials"
  | "invalid-recovery"
  | "rate-limited"
  | "unauthorized"
  | "network";

/** Typed error thrown by auth API calls. */
export class AuthApiError extends Error {
  readonly kind: AuthErrorKind;

  constructor(kind: AuthErrorKind, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.kind = kind;
  }
}
