import { error } from '@sveltejs/kit';
import { getAircraftCard } from '$lib/server/aircraft';
import { pickOtp } from '$lib/server/flights/otp';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const db = platform?.env.DB;
  const cache = platform?.env.CACHE;
  if (!db || !cache) throw error(500, 'Infrastructure unavailable');

  const flight = await db
    .prepare(
      `SELECT id, flight_no, flight_date, origin_iata, dest_iata,
              sched_dep_utc, sched_arr_utc, status, assigned_hex, assigned_reg,
              aircraft_type, paid_price_gbp, created_at
         FROM flights
        WHERE id = ?1 AND user_id = ?2 LIMIT 1`
    )
    .bind(params.id, locals.user.id)
    .first<{
      id: string;
      flight_no: string;
      flight_date: string;
      origin_iata: string | null;
      dest_iata: string | null;
      sched_dep_utc: number | null;
      sched_arr_utc: number | null;
      status: string;
      assigned_hex: string | null;
      assigned_reg: string | null;
      aircraft_type: string | null;
      paid_price_gbp: number | null;
      created_at: number;
    }>();
  if (!flight) throw error(404, 'Flight not found');

  const originRow = flight.origin_iata
    ? await db
        .prepare('SELECT iata, name, tz, country FROM airports WHERE iata = ?1 LIMIT 1')
        .bind(flight.origin_iata)
        .first<{ iata: string; name: string | null; tz: string | null; country: string | null }>()
    : null;
  const destRow = flight.dest_iata
    ? await db
        .prepare('SELECT iata, name, tz, country FROM airports WHERE iata = ?1 LIMIT 1')
        .bind(flight.dest_iata)
        .first<{ iata: string; name: string | null; tz: string | null; country: string | null }>()
    : null;

  const aircraft =
    flight.assigned_hex || flight.assigned_reg
      ? await getAircraftCard(
          { DB: db, CACHE: cache },
          { hex: flight.assigned_hex, reg: flight.assigned_reg }
        )
      : null;

  const airlineIata = flight.flight_no.match(/^[A-Z]{2}/)?.[0] ?? null;

  const otp = await pickOtp({
    db,
    origin_iata: flight.origin_iata,
    dest_iata: flight.dest_iata,
    airline_iata: airlineIata,
    airline_icao: null
  });

  return {
    flight,
    origin: originRow,
    dest: destRow,
    aircraft,
    otp,
    homeTz: locals.user.homeTz ?? 'Europe/London'
  };
};
