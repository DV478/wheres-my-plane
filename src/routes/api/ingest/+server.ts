import { error, json, type RequestHandler } from '@sveltejs/kit';
import { verifyIngest } from '$lib/server/hmac';
import { log } from '$lib/log';
import { z } from 'zod';

const BODY = z.object({
  table: z.enum(['aircraft', 'airports', 'positions_recent']),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500)
});

export const POST: RequestHandler = async ({ request, platform }) => {
  const env = platform?.env;
  if (!env?.DB || !env?.CACHE) throw error(500, 'Infrastructure unavailable');
  if (!env.WMP_INGEST_SECRET) throw error(503, 'Ingest not configured.');

  const raw = await request.text();

  await verifyIngest({
    rawBody: raw,
    signatureHeader: request.headers.get('x-wmp-signature'),
    nonceHeader: request.headers.get('x-wmp-nonce'),
    timestampHeader: request.headers.get('x-wmp-timestamp'),
    secret: env.WMP_INGEST_SECRET,
    kv: env.CACHE
  });

  let body;
  try {
    body = BODY.parse(JSON.parse(raw));
  } catch (err) {
    log.warn('ingest.bad_body', { err: String(err) });
    throw error(400, 'Invalid body.');
  }

  const writer = WRITERS[body.table];
  const written = await writer(env.DB, body.rows);
  log.info('ingest.ok', { table: body.table, written });
  return json({ ok: true, written });
};

type Writer = (db: App.Platform['env']['DB'], rows: Record<string, unknown>[]) => Promise<number>;

const WRITERS: Record<'aircraft' | 'airports' | 'positions_recent', Writer> = {
  aircraft: async (db, rows) => {
    let n = 0;
    const stmt = db.prepare(
      `INSERT INTO aircraft (hex, reg, type_icao, type_name, operator, build_year, source, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch())
       ON CONFLICT(hex) DO UPDATE SET
         reg=excluded.reg,
         type_icao=excluded.type_icao,
         type_name=excluded.type_name,
         operator=excluded.operator,
         build_year=excluded.build_year,
         source=excluded.source,
         updated_at=excluded.updated_at`
    );
    for (const r of rows) {
      await stmt
        .bind(
          String(r.hex).toLowerCase(),
          (r.reg as string | null) ?? null,
          (r.type_icao as string | null) ?? null,
          (r.type_name as string | null) ?? null,
          (r.operator as string | null) ?? null,
          (r.build_year as number | null) ?? null,
          (r.source as string | null) ?? 'opensky-csv'
        )
        .run();
      n++;
    }
    return n;
  },
  airports: async (db, rows) => {
    let n = 0;
    const stmt = db.prepare(
      `INSERT INTO airports (iata, icao, name, lat, lon, tz, country)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(iata) DO UPDATE SET
         icao=excluded.icao, name=excluded.name, lat=excluded.lat,
         lon=excluded.lon, tz=excluded.tz, country=excluded.country`
    );
    for (const r of rows) {
      await stmt
        .bind(
          String(r.iata).toUpperCase(),
          (r.icao as string | null) ?? null,
          (r.name as string | null) ?? null,
          (r.lat as number | null) ?? null,
          (r.lon as number | null) ?? null,
          (r.tz as string | null) ?? null,
          (r.country as string | null) ?? null
        )
        .run();
      n++;
    }
    return n;
  },
  positions_recent: async (db, rows) => {
    let n = 0;
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO positions_recent
         (hex, ts, lat, lon, alt_ft, gs_kt, heading, callsign, source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    );
    for (const r of rows) {
      await stmt
        .bind(
          String(r.hex).toLowerCase(),
          r.ts as number,
          r.lat as number,
          r.lon as number,
          (r.alt_ft as number | null) ?? null,
          (r.gs_kt as number | null) ?? null,
          (r.heading as number | null) ?? null,
          (r.callsign as string | null) ?? null,
          (r.source as string | null) ?? 'ingest'
        )
        .run();
      n++;
    }
    return n;
  }
};
