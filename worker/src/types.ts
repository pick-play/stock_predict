export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
  IP_SALT: string;
  ADMIN_TOKEN: string;
  /**
   * Short, memorable password for the moderator console.
   *
   * Checked only by POST /api/admin/login, which is attempt-limited per IP and
   * hands back ADMIN_TOKEN on success. It is never accepted as a bearer token:
   * a six-digit secret guarding an unthrottled delete API would be guessable.
   */
  ADMIN_PASSWORD?: string;
  ALLOWED_ORIGIN: string;
  PASSWORD_PEPPER: string;
  /**
   * GitHub token with Actions write on pick-play/stock_predict, used by the
   * baseline watchdog (lib/baselineWatchdog.ts) to dispatch workflows when
   * GitHub's own cron fails to run them. Optional: unset means the watchdog
   * logs and stands down (the is-configured rule).
   */
  GITHUB_DISPATCH_TOKEN?: string;
}

/** Public post shape returned by the API (matches board-api.md BoardPost). */
export interface BoardPost {
  id: string;
  body: string;
  authorTag: string;
  isMember: boolean;
  createdAt: string;
  reportCount: number;
  likeCount: number;
  commentCount: number;
}

/** Raw D1 row from the posts table. */
export interface PostRow {
  id: number;
  body: string;
  author_tag: string;
  ip_hash: string;
  dup_key: string;
  created_at: string;
  report_count: number;
  like_count: number;
  comment_count: number;
  hidden_at: string | null;
  member_id: number | null;
}

/** Public comment shape returned by the API (matches board-api.md BoardComment). */
export interface BoardComment {
  id: string;
  postId: string;
  body: string;
  authorTag: string;
  createdAt: string;
  reportCount: number;
}

/** Raw D1 row from the comments table. */
export interface CommentRow {
  id: number;
  post_id: number;
  body: string;
  author_tag: string;
  member_id: number;
  created_at: string;
  report_count: number;
  hidden_at: string | null;
}

/** Raw D1 row from the users table. */
export interface UserRow {
  id: number;
  nickname: string;
  nickname_normalized: string;
  password_salt: string;
  password_hash: string;
  recovery_code_hash: string;
  ip_hash: string;
  created_at: string;
}

/** Raw D1 row from the sessions table. */
export interface SessionRow {
  id: number;
  user_id: number;
  token_hash: string;
  created_at: string;
  expires_at: string;
}
