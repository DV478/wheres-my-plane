-- Migration: Phase 1 — flights, aircraft, airports.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS airports (
  iata           TEXT PRIMARY KEY,
  icao           TEXT,
  name           TEXT,
  lat            REAL,
  lon            REAL,
  tz             TEXT,
  country        TEXT
);
CREATE INDEX IF NOT EXISTS idx_airports_icao ON airports(icao);

CREATE TABLE IF NOT EXISTS aircraft (
  hex               TEXT PRIMARY KEY,
  reg               TEXT,
  type_icao         TEXT,
  type_name         TEXT,
  operator          TEXT,
  first_flight_date TEXT,
  delivery_date     TEXT,
  build_year        INTEGER,
  prev_regs_json    TEXT,
  photo_url         TEXT,
  photo_credit      TEXT,
  photo_link        TEXT,
  source            TEXT,
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_aircraft_reg ON aircraft(reg);

CREATE TABLE IF NOT EXISTS aircraft_reg_idx (
  reg            TEXT NOT NULL,
  hex            TEXT NOT NULL REFERENCES aircraft(hex) ON DELETE CASCADE,
  valid_from     TEXT,
  valid_to       TEXT,
  PRIMARY KEY (reg, hex)
);

CREATE TABLE IF NOT EXISTS flights (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_no         TEXT NOT NULL,
  flight_date       TEXT NOT NULL,
  origin_iata       TEXT,
  dest_iata         TEXT,
  sched_dep_utc     INTEGER,
  sched_arr_utc     INTEGER,
  status            TEXT NOT NULL DEFAULT 'scheduled',
  assigned_hex      TEXT,
  assigned_reg      TEXT,
  aircraft_type     TEXT,
  inbound_flight_id TEXT REFERENCES flights(id) ON DELETE SET NULL,
  paid_price_gbp    REAL,
  nlu_raw           TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_flights_user_date ON flights(user_id, flight_date);
CREATE INDEX IF NOT EXISTS idx_flights_user_sched ON flights(user_id, sched_dep_utc);

CREATE TABLE IF NOT EXISTS api_cache (
  cache_key      TEXT PRIMARY KEY,
  body_json      TEXT NOT NULL,
  source         TEXT,
  expires_at     INTEGER NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
