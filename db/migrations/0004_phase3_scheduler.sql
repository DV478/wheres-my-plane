-- Migration: Phase 3 — scheduler, events, Telegram linking.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS flight_checks (
  flight_id        TEXT PRIMARY KEY REFERENCES flights(id) ON DELETE CASCADE,
  next_check_at    INTEGER,
  last_check_at    INTEGER,
  window_open_at   INTEGER,
  window_close_at  INTEGER,
  cadence_sec      INTEGER NOT NULL DEFAULT 1800,
  last_status      TEXT,
  last_assigned_hex TEXT,
  last_assigned_reg TEXT,
  last_sched_dep_utc INTEGER
);
CREATE INDEX IF NOT EXISTS idx_flight_checks_next ON flight_checks(next_check_at);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  flight_id      TEXT REFERENCES flights(id) ON DELETE CASCADE,
  user_hash      TEXT,
  kind           TEXT NOT NULL,
  payload_json   TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_events_flight ON events(flight_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at);

CREATE TABLE IF NOT EXISTS tg_link_codes (
  code           TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at     INTEGER NOT NULL,
  consumed_at    INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tg_link_codes_user ON tg_link_codes(user_id);

ALTER TABLE users ADD COLUMN alerts_paused_until INTEGER;
