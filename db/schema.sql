-- Where's My Plane — full D1 schema (reference only).
-- Migrations in db/migrations/ apply this in phases.
-- This file is the target state; use it to read the shape, not to execute.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------
-- Phase 0: auth + invites
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invites (
  email          TEXT PRIMARY KEY,
  invited_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  note           TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,                -- random url-safe
  email          TEXT NOT NULL UNIQUE,
  tg_chat_id     TEXT,
  home_tz        TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at  INTEGER
);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token          TEXT PRIMARY KEY,                -- random url-safe
  email          TEXT NOT NULL,                   -- target (may not yet exist in users)
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
  ip_hash        TEXT                             -- hashed, not raw
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

------------------------------------------------------------------------
-- Phase 1: flights + aircraft + airports (not yet migrated)
------------------------------------------------------------------------

-- CREATE TABLE flights (
--   id             TEXT PRIMARY KEY,
--   user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   flight_no      TEXT NOT NULL,
--   flight_date    TEXT NOT NULL,              -- YYYY-MM-DD, origin local
--   origin_iata    TEXT,
--   dest_iata      TEXT,
--   sched_dep_utc  INTEGER,
--   sched_arr_utc  INTEGER,
--   status         TEXT NOT NULL DEFAULT 'scheduled',
--   assigned_hex   TEXT,
--   assigned_reg   TEXT,
--   aircraft_type  TEXT,
--   inbound_flight_id TEXT REFERENCES flights(id) ON DELETE SET NULL,
--   paid_price_gbp REAL,
--   created_at     INTEGER NOT NULL DEFAULT (unixepoch())
-- );

-- CREATE TABLE aircraft (
--   hex            TEXT PRIMARY KEY,            -- 24-bit Mode-S
--   reg            TEXT,
--   type_icao      TEXT,
--   type_name      TEXT,
--   operator       TEXT,
--   first_flight_date TEXT,
--   delivery_date  TEXT,
--   build_year     INTEGER,
--   prev_regs_json TEXT,                        -- JSON array of {reg, from, to}
--   source         TEXT,
--   updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
-- );

-- CREATE TABLE aircraft_reg_idx (
--   reg            TEXT NOT NULL,
--   hex            TEXT NOT NULL REFERENCES aircraft(hex),
--   valid_from     TEXT,
--   valid_to       TEXT,
--   PRIMARY KEY (reg, hex)
-- );

-- CREATE TABLE airports (
--   iata           TEXT PRIMARY KEY,
--   icao           TEXT,
--   name           TEXT,
--   lat            REAL,
--   lon            REAL,
--   tz             TEXT,
--   country        TEXT
-- );

------------------------------------------------------------------------
-- Phase 3: scheduler + events
------------------------------------------------------------------------

-- CREATE TABLE flight_checks (
--   flight_id      TEXT PRIMARY KEY REFERENCES flights(id) ON DELETE CASCADE,
--   next_check_at  INTEGER,
--   last_check_at  INTEGER,
--   window_open_at INTEGER,
--   window_close_at INTEGER,
--   cadence_sec    INTEGER NOT NULL DEFAULT 1800
-- );

-- CREATE TABLE events (
--   id             TEXT PRIMARY KEY,
--   flight_id      TEXT REFERENCES flights(id) ON DELETE CASCADE,
--   user_hash      TEXT,                        -- anonymised at write time
--   kind           TEXT NOT NULL,               -- 'tail_assigned'|'delay_change'|'cancelled'|'diverted'|'gate_change'|'alert_sent'|'price_drop'|...
--   payload_json   TEXT,
--   created_at     INTEGER NOT NULL DEFAULT (unixepoch())
-- );
-- CREATE INDEX idx_events_flight ON events(flight_id, created_at);

------------------------------------------------------------------------
-- Phase 4: cache (shared across users)
------------------------------------------------------------------------

-- CREATE TABLE api_cache (
--   cache_key      TEXT PRIMARY KEY,            -- e.g. 'aerodatabox:BA456:2026-11-05'
--   body_json      TEXT NOT NULL,
--   source         TEXT,
--   expires_at     INTEGER NOT NULL,
--   created_at     INTEGER NOT NULL DEFAULT (unixepoch())
-- );

-- CREATE TABLE scrape_log (
--   host           TEXT NOT NULL,
--   url            TEXT NOT NULL,
--   fetched_at     INTEGER NOT NULL,
--   status         INTEGER,
--   bytes          INTEGER,
--   PRIMARY KEY (host, url, fetched_at)
-- );

------------------------------------------------------------------------
-- Phase 2: positions (trimmed nightly)
------------------------------------------------------------------------

-- CREATE TABLE positions_recent (
--   hex            TEXT NOT NULL,
--   ts             INTEGER NOT NULL,
--   lat            REAL, lon REAL, alt INTEGER, gs INTEGER,
--   PRIMARY KEY (hex, ts)
-- );

------------------------------------------------------------------------
-- Phase 6: prices
------------------------------------------------------------------------

-- CREATE TABLE prices (
--   id             TEXT PRIMARY KEY,
--   flight_id      TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
--   polled_at      INTEGER NOT NULL,
--   carrier        TEXT,
--   price_gbp      REAL NOT NULL,
--   cabin          TEXT,
--   deeplink       TEXT,
--   source         TEXT
-- );

-- CREATE TABLE price_watches (
--   flight_id      TEXT PRIMARY KEY REFERENCES flights(id) ON DELETE CASCADE,
--   market_baseline_gbp REAL,
--   drop_threshold_pct  REAL NOT NULL DEFAULT 10,
--   last_alerted_at     INTEGER
-- );

------------------------------------------------------------------------
-- Phase 1+: regional enrichments
------------------------------------------------------------------------

-- CREATE TABLE routes_otp (
--   origin TEXT, dest TEXT, carrier TEXT, month TEXT,
--   otp15 REAL, source TEXT,
--   PRIMARY KEY (origin, dest, carrier, month)
-- );

-- CREATE TABLE airport_otp (
--   iata TEXT, day TEXT, delay_min REAL, source TEXT,
--   PRIMARY KEY (iata, day)
-- );

------------------------------------------------------------------------
-- Phase 7: web push
------------------------------------------------------------------------

-- CREATE TABLE push_subs (
--   id             TEXT PRIMARY KEY,
--   user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   endpoint       TEXT NOT NULL,
--   p256dh         TEXT NOT NULL,
--   auth           TEXT NOT NULL,
--   created_at     INTEGER NOT NULL DEFAULT (unixepoch())
-- );
