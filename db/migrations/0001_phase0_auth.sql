-- Migration: Phase 0 — auth, invites, sessions.
-- Applied via `npm run db:migrate:local` (dev) or `npm run db:migrate:remote` (prod).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS invites (
  email          TEXT PRIMARY KEY,
  invited_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  note           TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  tg_chat_id     TEXT,
  home_tz        TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at  INTEGER
);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token          TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  expires_at     INTEGER NOT NULL,
  consumed_at    INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens(email);

CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at     INTEGER NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  user_agent     TEXT,
  ip_hash        TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
