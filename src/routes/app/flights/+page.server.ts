import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database unavailable');

  const todayUtc = Math.floor(Date.now() / 1000) - 24 * 3600;

  const rows = await db
    .prepare(
      `SELECT id, flight_no, flight_date, origin_iata, dest_iata,
              sched_dep_utc, sched_arr_utc, status, assigned_reg, aircraft_type
         FROM flights
        WHERE user_id = ?1
          AND (sched_dep_utc IS NULL OR sched_dep_utc >= ?2)
        ORDER BY sched_dep_utc IS NULL, sched_dep_utc ASC
        LIMIT 100`
    )
    .bind(locals.user.id, todayUtc)
    .all<{
      id: string;
      flight_no: string;
      flight_date: string;
      origin_iata: string | null;
      dest_iata: string | null;
      sched_dep_utc: number | null;
      sched_arr_utc: number | null;
      status: string;
      assigned_reg: string | null;
      aircraft_type: string | null;
    }>();

  return { flights: rows.results ?? [] };
};
