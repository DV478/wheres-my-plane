import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { ResolvedFlight } from '../flights/types';

const BASE = 'http://api.aviationstack.com/v1';

const AV_RESPONSE = z.object({
  data: z
    .array(
      z.object({
        flight_date: z.string().optional(),
        flight_status: z.string().optional(),
        departure: z
          .object({
            iata: z.string().optional(),
            icao: z.string().optional(),
            scheduled: z.string().optional()
          })
          .optional(),
        arrival: z
          .object({
            iata: z.string().optional(),
            scheduled: z.string().optional()
          })
          .optional(),
        airline: z
          .object({ iata: z.string().optional(), icao: z.string().optional() })
          .optional(),
        flight: z.object({ iata: z.string().optional() }).optional(),
        aircraft: z
          .object({
            registration: z.string().optional(),
            icao: z.string().optional(),
            icao24: z.string().optional()
          })
          .nullable()
          .optional()
      })
    )
    .optional()
});

export interface AviationstackEnv {
  AVIATIONSTACK_KEY: string;
  CACHE: KVNamespace;
}

export async function getFlight(
  env: AviationstackEnv,
  flightNo: string,
  isoDate: string
): Promise<ResolvedFlight | null> {
  const url = `${BASE}/flights?access_key=${encodeURIComponent(env.AVIATIONSTACK_KEY)}&flight_iata=${encodeURIComponent(flightNo)}&flight_date=${isoDate}`;
  const cacheKey = `aviationstack:flight:${flightNo}:${isoDate}`;

  const data = await httpJson<unknown>(
    url,
    {},
    { kv: env.CACHE, cacheKey, ttlSec: 3600, source: 'aviationstack' }
  );

  const parsed = AV_RESPONSE.safeParse(data);
  if (!parsed.success || !parsed.data.data || parsed.data.data.length === 0) return null;
  const f = parsed.data.data[0];

  return {
    flight_no: (f.flight?.iata ?? flightNo).replace(/\s+/g, ''),
    flight_date: f.flight_date ?? isoDate,
    origin_iata: f.departure?.iata ?? null,
    dest_iata: f.arrival?.iata ?? null,
    sched_dep_utc: parseUtc(f.departure?.scheduled),
    sched_arr_utc: parseUtc(f.arrival?.scheduled),
    status: mapStatus(f.flight_status),
    assigned_hex: f.aircraft?.icao24 ? f.aircraft.icao24.toLowerCase() : null,
    assigned_reg: f.aircraft?.registration ?? null,
    aircraft_type: f.aircraft?.icao ?? null,
    airline_iata: f.airline?.iata ?? null,
    airline_icao: f.airline?.icao ?? null,
    source: 'aviationstack'
  };
}

function parseUtc(s: string | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function mapStatus(s: string | undefined): ResolvedFlight['status'] {
  const x = (s ?? '').toLowerCase();
  if (x === 'cancelled') return 'cancelled';
  if (x === 'diverted') return 'diverted';
  if (x === 'landed') return 'landed';
  if (x === 'active') return 'airborne';
  if (x === 'scheduled') return 'scheduled';
  return 'unknown';
}
