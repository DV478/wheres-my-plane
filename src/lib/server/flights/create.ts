import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { AppError } from '$lib/errors';
import { randomId } from '../random';
import { resolveFlight, type ResolveEnv } from './resolve';
import { parseFlightIntent, type NluEnv } from '../nlu';
import { recomputeNextCheck } from '../scheduler';

export interface CreateFlightEnv extends ResolveEnv, NluEnv {
  DB: D1Database;
  CACHE: KVNamespace;
}

export interface CreateFlightInput {
  userId: string;
  text?: string;
  flight_no?: string;
  flight_date?: string;
  paid_price_gbp?: number | null;
  homeTz: string;
}

export interface CreateFlightResult {
  id: string;
  flight_no: string;
  flight_date: string;
}

export async function createFlight(
  env: CreateFlightEnv,
  input: CreateFlightInput
): Promise<CreateFlightResult> {
  let flight_no = input.flight_no?.trim().toUpperCase();
  let flight_date = input.flight_date?.trim();

  if ((!flight_no || !flight_date) && input.text) {
    const nlu = await parseFlightIntent(env, input.text, { homeTz: input.homeTz });
    if (!nlu) {
      throw new AppError({
        code: 'nlu_failed',
        status: 400,
        publicMessage: "Couldn't understand that. Try 'BA456 tomorrow' or use the form."
      });
    }
    flight_no = flight_no ?? nlu.flight_no;
    flight_date = flight_date ?? nlu.flight_date;
  }

  if (!flight_no || !/^[A-Z]{2,3}\d{1,4}[A-Z]?$/.test(flight_no)) {
    throw new AppError({
      code: 'bad_flight_no',
      status: 400,
      publicMessage: 'Please provide a valid flight number like BA456.'
    });
  }
  if (!flight_date || !/^\d{4}-\d{2}-\d{2}$/.test(flight_date)) {
    throw new AppError({
      code: 'bad_flight_date',
      status: 400,
      publicMessage: 'Please provide a date as YYYY-MM-DD.'
    });
  }

  const resolved = await resolveFlight(env, flight_no, flight_date);

  const id = randomId(16);
  await env.DB
    .prepare(
      `INSERT INTO flights (
         id, user_id, flight_no, flight_date, origin_iata, dest_iata,
         sched_dep_utc, sched_arr_utc, status, assigned_hex, assigned_reg,
         aircraft_type, paid_price_gbp, nlu_raw
       ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`
    )
    .bind(
      id,
      input.userId,
      resolved.flight_no,
      resolved.flight_date,
      resolved.origin_iata,
      resolved.dest_iata,
      resolved.sched_dep_utc,
      resolved.sched_arr_utc,
      resolved.status,
      resolved.assigned_hex,
      resolved.assigned_reg,
      resolved.aircraft_type,
      input.paid_price_gbp ?? null,
      input.text ?? null
    )
    .run();

  // Seed the scheduler row. The agent will take over from here.
  const now = Math.floor(Date.now() / 1000);
  const sched = await recomputeNextCheck(env.DB, resolved, now, {
    window_open_at: null,
    window_close_at: null
  });
  await env.DB
    .prepare(
      `INSERT INTO flight_checks (
         flight_id, next_check_at, last_check_at, window_open_at, window_close_at,
         cadence_sec, last_status, last_assigned_hex, last_assigned_reg, last_sched_dep_utc
       ) VALUES (?1,?2,NULL,?3,?4,?5,?6,?7,?8,?9)
       ON CONFLICT(flight_id) DO UPDATE SET
         next_check_at = excluded.next_check_at,
         window_open_at = excluded.window_open_at,
         window_close_at = excluded.window_close_at,
         cadence_sec = excluded.cadence_sec,
         last_status = excluded.last_status,
         last_assigned_hex = excluded.last_assigned_hex,
         last_assigned_reg = excluded.last_assigned_reg,
         last_sched_dep_utc = excluded.last_sched_dep_utc`
    )
    .bind(
      id,
      sched.next_check_at,
      sched.window_open_at,
      sched.window_close_at,
      sched.cadence_sec,
      resolved.status,
      resolved.assigned_hex,
      resolved.assigned_reg,
      resolved.sched_dep_utc
    )
    .run();

  return { id, flight_no: resolved.flight_no, flight_date: resolved.flight_date };
}
