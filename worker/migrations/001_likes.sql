-- Adds the popularity signal the main-screen ticker ranks on.
-- Apply once to an existing database:
--   wrangler d1 execute stock-predict-board --remote --file=migrations/001_likes.sql
-- Fresh databases get the same shape from schema.sql.

ALTER TABLE posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS likes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  ip_hash    TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  UNIQUE (post_id, ip_hash)
);

-- Ranking reads like_count first and falls back to recency, so index both.
CREATE INDEX IF NOT EXISTS idx_posts_popular ON posts (like_count DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_likes_iphash ON likes (ip_hash, created_at);
