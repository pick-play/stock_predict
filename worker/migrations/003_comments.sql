-- Adds comments and comment_reports tables, and a comment_count column on posts.
-- Apply once to an existing database:
--   wrangler d1 execute stock-predict-board --remote --file=migrations/003_comments.sql
-- Fresh databases get the same shape from schema.sql.

CREATE TABLE IF NOT EXISTS comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL,
  author_tag   TEXT    NOT NULL,
  member_id    INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  hidden_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments (post_id, id ASC);
CREATE INDEX IF NOT EXISTS idx_comments_member ON comments (member_id, created_at);

CREATE TABLE IF NOT EXISTS comment_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reason     TEXT,
  ip_hash    TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  UNIQUE (comment_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_comment_reports ON comment_reports (ip_hash, created_at);

ALTER TABLE posts ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;
