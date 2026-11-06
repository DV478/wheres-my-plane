import { error, json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const env = platform?.env;
  if (!env?.DB) throw error(500, 'Infrastructure unavailable');

  const hex = params.hex?.toLowerCase() ?? '';
  if (!/^[0-9a-f]{6}$/.test(hex)) throw error(400, 'Bad hex.');

  const sinceTs = Math.floor(Date.now() / 1000) - 24 * 3600;
  const trail = await env.DB.prepare(
    `SELECT hex, ts, lat, lon FROM positions_recent
     WHERE hex=?1 AND ts >= ?2
     ORDER BY ts ASC
     LIMIT 2000`
  )
    .bind(hex, sinceTs)
    .all<{ hex: string; ts: number; lat: number; lon: number }>();

  const arc = await env.DB.prepare(
    `SELECT f.id, f.flight_no,
            oa.lat AS o_lat, oa.lon AS o_lon,
            da.lat AS d_lat, da.lon AS d_lon
     FROM flights f
     LEFT JOIN airports oa ON oa.iata = f.origin_iata
     LEFT JOIN airports da ON da.iata = f.dest_iata
     WHERE f.assigned_hex = ?1
       AND f.user_id = ?2
     ORDER BY f.sched_dep_utc DESC
     LIMIT 1`
  )
    .bind(hex, locals.user.id)
    .first<{
      id: string;
      flight_no: string;
      o_lat: number | null;
      o_lon: number | null;
      d_lat: number | null;
      d_lon: number | null;
    }>();

  return json({
    ok: true,
    points: trail.results ?? [],
    scheduled:
      arc && arc.o_lat != null && arc.d_lat != null
        ? {
            flightNo: arc.flight_no,
            originLat: arc.o_lat,
            originLon: arc.o_lon,
            destLat: arc.d_lat,
            destLon: arc.d_lon
          }
        : null
  });
};
