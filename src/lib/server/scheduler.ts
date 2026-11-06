import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { log } from '$lib/log';
import { resolveFlight, type ResolveEnv } from './flights/resolve';
import type { ResolvedFlight } from './flights/types';
import { diffFlight, describeChange, type LastKnown, type MaterialChange } from './agent/diff';
import { sendMessage, escapeMd, type TelegramEnv } from './providers/telegram';
import { hashUser } from './user_hash';
import { randomId } from './random';

const BATCH_SIZE = 50;
const LOCK_KEY = 'cron:lock';
const LOCK_TTL_SEC = 60;

const SHORT_HAUL_WINDOW_SEC = 6 * 60 * 60;
const LONG_HAUL_WINDOW_SEC = 12 * 60 * 60;
const LONG_HAUL_DIST_KM = 5000;

const CADENCE_DEFAULT = 30 * 60;
const CADENCE_TAIL_ASSIGNED = 15 * 60;
const CADENCE_T_MINUS_2H = 5 * 60;

const T_MINUS_2H_SEC = 2 * 60 * 60;
const WINDOW_CLOSE_AFTER_DEP_SEC = 60 * 60;

export interface SchedulerEnv extends ResolveEnv, TelegramEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN?: string;
}

interface FlightCheckRow {
  flight_id: string;
  user_id: string;
  flight_no: string;
  flight_date: string;
  origin_iata: string | null;
  dest_iata: string | null;
  sched_dep_utc: number | null;
  tg_chat_id: string | null;
  alerts_paused_until: number | null;
  last_status: string | null;
  last_assigned_hex: string | null;
  last_assigned_reg: string | null;
  last_sched_dep_utc: number | null;
  window_open_at: number | null;
  window_close_at: number | null;
}

export interface TickResult {
  processed: number;
  alerts_sent: number;
  errors: number;
}

export async function tickOnce(env: SchedulerEnv, now = nowSec()): Promise<TickResult> {
  const held = await env.CACHE.get(LOCK_KEY);
  if (held) {
    log.info('scheduler.skip', { reason: 'lock_held' });
    return { processed: 0, alerts_sent: 0, errors: 0 };
  }
  await env.CACHE.put(LOCK_KEY, '1', { expirationTtl: LOCK_TTL_SEC });

  try {
    const { results } = await env.DB
      .prepare(
        `SELECT fc.flight_id, fc.last_status, fc.last_assigned_hex, fc.last_assigned_reg,
                fc.last_sched_dep_utc, fc.window_open_at, fc.window_close_at,
                f.user_id, f.flight_no, f.flight_date, f.origin_iata, f.dest_iata,
                f.sched_dep_utc,
                u.tg_chat_id, u.alerts_paused_until
           FROM flight_checks fc
           JOIN flights f ON f.id = fc.flight_id
           JOIN users u ON u.id = f.user_id
          WHERE fc.next_check_at IS NOT NULL AND fc.next_check_at <= ?1
          ORDER BY fc.next_check_at ASC
          LIMIT ?2`
      )
      .bind(now, BATCH_SIZE)
      .all<FlightCheckRow>();

    const rows = results ?? [];
    log.info('scheduler.tick', { due: rows.length });

    let alertsSent = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const sent = await processOne(env, row, now);
        if (sent) alertsSent++;
      } catch (err) {
        errors++;
        log.warn('scheduler.row_err', { flight_id: row.flight_id, err: String(err) });
        // On failure, push next_check_at back by one cadence so we retry.
        await env.DB
          .prepare('UPDATE flight_checks SET next_check_at = ?2, last_check_at = ?3 WHERE flight_id = ?1')
          .bind(row.flight_id, now + CADENCE_DEFAULT, now)
          .run();
      }
    }

    return { processed: rows.length, alerts_sent: alertsSent, errors };
  } finally {
    await env.CACHE.delete(LOCK_KEY);
  }
}

async function processOne(env: SchedulerEnv, row: FlightCheckRow, now: number): Promise<boolean> {
  const resolved = await resolveFlight(env, row.flight_no, row.flight_date);

  const prev: LastKnown = {
    last_status: row.last_status,
    last_assigned_hex: row.last_assigned_hex,
    last_assigned_reg: row.last_assigned_reg,
    last_sched_dep_utc: row.last_sched_dep_utc
  };

  const changes = diffFlight(prev, resolved);
  const userHash = await hashUser(row.user_id, env.SESSION_SECRET);

  for (const change of changes) {
    await env.DB
      .prepare(
        `INSERT INTO events (id, flight_id, user_hash, kind, payload_json)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      )
      .bind(randomId(12), row.flight_id, userHash, change.kind, JSON.stringify(change))
      .run();
  }

  // Keep flights table's denormalised fields fresh.
  await env.DB
    .prepare(
      `UPDATE flights
         SET status = ?2,
             assigned_hex = COALESCE(?3, assigned_hex),
             assigned_reg = COALESCE(?4, assigned_reg),
             aircraft_type = COALESCE(?5, aircraft_type),
             sched_dep_utc = COALESCE(?6, sched_dep_utc),
             sched_arr_utc = COALESCE(?7, sched_arr_utc)
       WHERE id = ?1`
    )
    .bind(
      row.flight_id,
      resolved.status,
      resolved.assigned_hex,
      resolved.assigned_reg,
      resolved.aircraft_type,
      resolved.sched_dep_utc,
      resolved.sched_arr_utc
    )
    .run();

  let sent = false;
  const muted = row.alerts_paused_until != null && row.alerts_paused_until > now;
  if (changes.length > 0 && row.tg_chat_id && env.TELEGRAM_BOT_TOKEN && !muted) {
    const body = await composeAlert(env.DB, row, resolved, changes);
    try {
      await sendMessage({ TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN }, row.tg_chat_id, body, {
        parseMode: 'MarkdownV2'
      });
      sent = true;
      await env.DB
        .prepare(
          `INSERT INTO events (id, flight_id, user_hash, kind, payload_json)
           VALUES (?1, ?2, ?3, 'alert_sent', ?4)`
        )
        .bind(randomId(12), row.flight_id, userHash, JSON.stringify({ chat_id: row.tg_chat_id }))
        .run();
    } catch (err) {
      log.warn('scheduler.telegram_fail', { flight_id: row.flight_id, err: String(err) });
    }
  }

  // Compute next check and update window/cadence/caches.
  const sched = await recomputeNextCheck(env.DB, resolved, now, row);
  await env.DB
    .prepare(
      `UPDATE flight_checks
         SET next_check_at = ?2,
             last_check_at = ?3,
             window_open_at = ?4,
             window_close_at = ?5,
             cadence_sec = ?6,
             last_status = ?7,
             last_assigned_hex = ?8,
             last_assigned_reg = ?9,
             last_sched_dep_utc = ?10
       WHERE flight_id = ?1`
    )
    .bind(
      row.flight_id,
      sched.next_check_at,
      now,
      sched.window_open_at,
      sched.window_close_at,
      sched.cadence_sec,
      resolved.status,
      resolved.assigned_hex ?? row.last_assigned_hex,
      resolved.assigned_reg ?? row.last_assigned_reg,
      resolved.sched_dep_utc ?? row.last_sched_dep_utc
    )
    .run();

  return sent;
}

async function composeAlert(
  _db: D1Database,
  row: FlightCheckRow,
  resolved: ResolvedFlight,
  changes: MaterialChange[]
): Promise<string> {
  const header = `*${escapeMd(resolved.flight_no)}* ${escapeMd(resolved.flight_date)}`;
  const route = [resolved.origin_iata, resolved.dest_iata]
    .filter(Boolean)
    .map((x) => escapeMd(x!))
    .join(' → ');
  const lines = changes.map((c) => `• ${escapeMd(describeChange(c))}`);
  return [header, route, '', ...lines].filter((x) => x !== undefined).join('\n');
}

export interface Schedule {
  next_check_at: number | null;
  window_open_at: number | null;
  window_close_at: number | null;
  cadence_sec: number;
}

export async function recomputeNextCheck(
  db: D1Database,
  resolved: ResolvedFlight,
  now: number,
  cached: { window_open_at: number | null; window_close_at: number | null }
): Promise<Schedule> {
  const sched_dep = resolved.sched_dep_utc;

  // No scheduled departure? One check per hour.
  if (sched_dep == null) {
    return {
      next_check_at: now + 60 * 60,
      window_open_at: null,
      window_close_at: null,
      cadence_sec: 60 * 60
    };
  }

  const window_open_at =
    cached.window_open_at ?? (await computeWindowOpen(db, resolved, sched_dep));
  const window_close_at = cached.window_close_at ?? sched_dep + WINDOW_CLOSE_AFTER_DEP_SEC;

  // Past close → inert.
  if (now >= window_close_at || resolved.status === 'landed' || resolved.status === 'cancelled') {
    return {
      next_check_at: null,
      window_open_at,
      window_close_at,
      cadence_sec: CADENCE_DEFAULT
    };
  }

  // Before window → sleep until it opens.
  if (now < window_open_at) {
    return {
      next_check_at: window_open_at,
      window_open_at,
      window_close_at,
      cadence_sec: CADENCE_DEFAULT
    };
  }

  // Inside window — pick cadence.
  let cadence = CADENCE_DEFAULT;
  if (resolved.assigned_hex) cadence = CADENCE_TAIL_ASSIGNED;
  if (sched_dep - now <= T_MINUS_2H_SEC) cadence = CADENCE_T_MINUS_2H;

  const next = Math.min(now + cadence, window_close_at);
  return {
    next_check_at: next,
    window_open_at,
    window_close_at,
    cadence_sec: cadence
  };
}

async function computeWindowOpen(
  db: D1Database,
  resolved: ResolvedFlight,
  sched_dep: number
): Promise<number> {
  const longHaul = await isLongHaul(db, resolved.origin_iata, resolved.dest_iata);
  return sched_dep - (longHaul ? LONG_HAUL_WINDOW_SEC : SHORT_HAUL_WINDOW_SEC);
}

async function isLongHaul(
  db: D1Database,
  origin: string | null,
  dest: string | null
): Promise<boolean> {
  if (!origin || !dest) return false;
  const row = await db
    .prepare(
      `SELECT o.lat AS olat, o.lon AS olon, d.lat AS dlat, d.lon AS dlon
         FROM airports o, airports d
        WHERE o.iata = ?1 AND d.iata = ?2`
    )
    .bind(origin.toUpperCase(), dest.toUpperCase())
    .first<{ olat: number | null; olon: number | null; dlat: number | null; dlon: number | null }>();
  if (!row?.olat || !row.olon || !row.dlat || !row.dlon) return false;
  return haversineKm(row.olat, row.olon, row.dlat, row.dlon) > LONG_HAUL_DIST_KM;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
