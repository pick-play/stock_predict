-- Adds user accounts and sessions for the optional login feature.
-- Apply once to an existing database:
--   wrangler d1 execute stock-predict-board --remote --file=migrations/002_accounts.sql
-- Fresh databases get the same shape from schema.sql.

CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname            TEXT    NOT NULL,
  nickname_normalized TEXT    NOT NULL UNIQUE,
  password_salt       TEXT    NOT NULL,
  password_hash       TEXT    NOT NULL,
  recovery_code_hash  TEXT    NOT NULL,
  ip_hash             TEXT    NOT NULL,
  created_at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_normalized ON users (nickname_normalized);
CREATE INDEX IF NOT EXISTS idx_users_iphash     ON users (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  created_at  TEXT    NOT NULL,
  expires_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token  ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_userid ON sessions (user_id, expires_at);

-- Tracks all login and reset-password attempts for rate limiting.
-- No sensitive data is stored — only the daily-rotating IP hash.
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash    TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts (ip_hash, created_at);

-- Link posts to their author when written while logged in.
ALTER TABLE posts ADD COLUMN member_id INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_posts_member ON posts (member_id);
