/**
 * Board types shared between UI components and the API client.
 * Mirrors the contract defined in docs/board-api.md.
 */

export interface BoardPost {
  id: string;
  /** Plain text — caller must render as text, never set as innerHTML. */
  body: string;
  authorTag: string;
  createdAt: string;
  reportCount: number;
  likeCount: number;
}

export interface LikeResponse {
  ok: boolean;
  likeCount: number;
  alreadyLiked: boolean;
}

export interface BoardListResponse {
  posts: BoardPost[];
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
