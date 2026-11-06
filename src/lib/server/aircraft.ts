import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { log } from '$lib/log';
import { getAircraftByHex } from './providers/adsbdb';
import { getPhotoByHex, getPhotoByReg } from './providers/planespotters';
import type { AircraftPhoto, AircraftRecord } from './flights/types';

export interface AircraftEnv {
  DB: D1Database;
  CACHE: KVNamespace;
}

export interface AircraftCardData {
  hex: string | null;
  reg: string | null;
  type_icao: string | null;
  type_name: string | null;
  operator: string | null;
  first_flight_date: string | null;
  delivery_date: string | null;
  build_year: number | null;
  age_years: number | null;
  prev_regs: Array<{ reg: string; from: string | null; to: string | null }> | null;
  photo: AircraftPhoto | null;
  source: string;
}

export async function getAircraftCard(
  env: AircraftEnv,
  key: { hex?: string | null; reg?: string | null }
): Promise<AircraftCardData | null> {
  const hex = key.hex?.toLowerCase() ?? null;
  const reg = key.reg?.toUpperCase() ?? null;
  if (!hex && !reg) return null;

  let row = await selectAircraft(env.DB, { hex, reg });

  if (!row && hex) {
    try {
      const fresh = await getAircraftByHex({ CACHE: env.CACHE }, hex);
      if (fresh) {
        await upsertAircraft(env.DB, fresh);
        row = await selectAircraft(env.DB, { hex, reg });
      }
    } catch (err) {
      log.warn('aircraft.adsbdb.fail', { err: String(err) });
    }
  }

  let photo: AircraftPhoto | null = null;
  try {
    if (hex) photo = await getPhotoByHex({ CACHE: env.CACHE }, hex);
    if (!photo && reg) photo = await getPhotoByReg({ CACHE: env.CACHE }, reg);
    else if (!photo && row?.reg) photo = await getPhotoByReg({ CACHE: env.CACHE }, row.reg);
  } catch (err) {
    log.warn('aircraft.photo.fail', { err: String(err) });
  }

  if (!row) {
    if (!hex && !reg) return null;
    return {
      hex: hex,
      reg: reg,
      type_icao: null,
      type_name: null,
      operator: null,
      first_flight_date: null,
      delivery_date: null,
      build_year: null,
      age_years: null,
      prev_regs: null,
      photo,
      source: 'unknown'
    };
  }

  const build_year = row.build_year ?? yearFromIso(row.first_flight_date) ?? yearFromIso(row.delivery_date);
  const age_years = build_year ? new Date().getUTCFullYear() - build_year : null;

  return {
    hex: row.hex,
    reg: row.reg,
    type_icao: row.type_icao,
    type_name: row.type_name,
    operator: row.operator,
    first_flight_date: row.first_flight_date,
    delivery_date: row.delivery_date,
    build_year,
    age_years,
    prev_regs: row.prev_regs_json ? safeJson(row.prev_regs_json) : null,
    photo,
    source: row.source ?? 'd1'
  };
}

interface Row {
  hex: string;
  reg: string | null;
  type_icao: string | null;
  type_name: string | null;
  operator: string | null;
  first_flight_date: string | null;
  delivery_date: string | null;
  build_year: number | null;
  prev_regs_json: string | null;
  source: string | null;
}

async function selectAircraft(
  db: D1Database,
  key: { hex: string | null; reg: string | null }
): Promise<Row | null> {
  if (key.hex) {
    const row = await db
      .prepare(
        `SELECT hex, reg, type_icao, type_name, operator, first_flight_date,
                delivery_date, build_year, prev_regs_json, source
           FROM aircraft WHERE hex = ?1 LIMIT 1`
      )
      .bind(key.hex)
      .first<Row>();
    if (row) return row;
  }
  if (key.reg) {
    const row = await db
      .prepare(
        `SELECT hex, reg, type_icao, type_name, operator, first_flight_date,
                delivery_date, build_year, prev_regs_json, source
           FROM aircraft WHERE reg = ?1 LIMIT 1`
      )
      .bind(key.reg)
      .first<Row>();
    if (row) return row;
  }
  return null;
}

async function upsertAircraft(db: D1Database, rec: Partial<AircraftRecord>): Promise<void> {
  if (!rec.hex) return;
  await db
    .prepare(
      `INSERT INTO aircraft (hex, reg, type_icao, type_name, operator,
                             first_flight_date, delivery_date, build_year,
                             prev_regs_json, source, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,unixepoch())
       ON CONFLICT(hex) DO UPDATE SET
         reg = COALESCE(excluded.reg, aircraft.reg),
         type_icao = COALESCE(excluded.type_icao, aircraft.type_icao),
         type_name = COALESCE(excluded.type_name, aircraft.type_name),
         operator = COALESCE(excluded.operator, aircraft.operator),
         first_flight_date = COALESCE(excluded.first_flight_date, aircraft.first_flight_date),
         delivery_date = COALESCE(excluded.delivery_date, aircraft.delivery_date),
         build_year = COALESCE(excluded.build_year, aircraft.build_year),
         prev_regs_json = COALESCE(excluded.prev_regs_json, aircraft.prev_regs_json),
         source = COALESCE(excluded.source, aircraft.source),
         updated_at = unixepoch()`
    )
    .bind(
      rec.hex,
      rec.reg ?? null,
      rec.type_icao ?? null,
      rec.type_name ?? null,
      rec.operator ?? null,
      rec.first_flight_date ?? null,
      rec.delivery_date ?? null,
      rec.build_year ?? null,
      rec.prev_regs ? JSON.stringify(rec.prev_regs) : null,
      rec.source ?? 'unknown'
    )
    .run();
}

function safeJson<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function yearFromIso(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})/.exec(s);
  return m ? parseInt(m[1], 10) : null;
}
