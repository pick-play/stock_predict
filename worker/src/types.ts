export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
  IP_SALT: string;
  ADMIN_TOKEN: string;
  ALLOWED_ORIGIN: string;
}

/** Public post shape returned by the API (matches board-api.md BoardPost). */
export interface BoardPost {
  id: string;
  body: string;
  authorTag: string;
  createdAt: string;
  reportCount: number;
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
  hidden_at: string | null;
}
