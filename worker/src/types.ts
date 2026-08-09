export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
  IP_SALT: string;
  ADMIN_TOKEN: string;
  ALLOWED_ORIGIN: string;
  PASSWORD_PEPPER: string;
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
  hidden_at: string | null;
  member_id: number | null;
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
