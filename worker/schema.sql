-- Anonymous board schema for Cloudflare D1
-- Run once: wrangler d1 execute stock-predict-board --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  body         TEXT    NOT NULL,
  author_tag   TEXT    NOT NULL,
  ip_hash      TEXT    NOT NULL,
  dup_key      TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  hidden_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_iphash  ON posts (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_dupkey  ON posts (dup_key, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason     TEXT,
  ip_hash    TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  UNIQUE (post_id, ip_hash)
);
