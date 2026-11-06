-- Migration: Phase 2 — live positions + scrape log.
-- api_cache already created in 0002.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS positions_recent (
  hex        TEXT NOT NULL,
  ts         INTEGER NOT NULL,
  lat        REAL NOT NULL,
  lon        REAL NOT NULL,
  alt_ft     INTEGER,
  gs_kt      INTEGER,
  heading    INTEGER,
  callsign   TEXT,
  source     TEXT NOT NULL,
  PRIMARY KEY (hex, ts)
);
CREATE INDEX IF NOT EXISTS idx_positions_ts ON positions_recent(ts);
CREATE INDEX IF NOT EXISTS idx_positions_hex_ts ON positions_recent(hex, ts DESC);

CREATE TABLE IF NOT EXISTS scrape_log (
  id         TEXT PRIMARY KEY,
  job        TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,
  status     TEXT NOT NULL,
  rows       INTEGER,
  note       TEXT
);
CREATE INDEX IF NOT EXISTS idx_scrape_log_job_started ON scrape_log(job, started_at DESC);
