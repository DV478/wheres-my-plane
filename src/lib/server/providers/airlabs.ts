import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { ResolvedFlight } from '../flights/types';

const BASE = 'https://airlabs.co/api/v9';

const ALABS_RESPONSE = z.object({
  response: z
    .object({
      hex: z.string().optional(),
      reg_number: z.string().optional(),
      flight_iata: z.string().optional(),
      flight_icao: z.string().optional(),
      dep_iata: z.string().optional(),
      dep_icao: z.string().optional(),
      arr_iata: z.string().optional(),
      arr_icao: z.string().optional(),
      airline_iata: z.string().optional(),
      airline_icao: z.string().optional(),
      aircraft_icao: z.string().optional(),
      status: z.string().optional(),
      dep_time_utc: z.string().optional(),
      arr_time_utc: z.string().optional()
    })
    .nullable()
    .optional()
});

export interface AirlabsEnv {
  AIRLABS_KEY: string;
  CACHE: KVNamespace;
}

export async function getFlight(
  env: AirlabsEnv,
  flightNo: string,
  isoDate: string
): Promise<ResolvedFlight | null> {
  const url = `${BASE}/flight?flight_iata=${encodeURIComponent(flightNo)}&api_key=${encodeURIComponent(env.AIRLABS_KEY)}`;
  const cacheKey = `airlabs:flight:${flightNo}:${isoDate}`;

  const data = await httpJson<unknown>(
    url,
    {},
    { kv: env.CACHE, cacheKey, ttlSec: 300, source: 'airlabs' }
  );

  const parsed = ALABS_RESPONSE.safeParse(data);
  if (!parsed.success || !parsed.data.response) return null;
  const f = parsed.data.response;

  return {
    flight_no: (f.flight_iata ?? flightNo).replace(/\s+/g, ''),
    flight_date: isoDate,
    origin_iata: f.dep_iata ?? null,
    dest_iata: f.arr_iata ?? null,
    sched_dep_utc: parseUtc(f.dep_time_utc),
    sched_arr_utc: parseUtc(f.arr_time_utc),
    status: mapStatus(f.status),
    assigned_hex: f.hex ? f.hex.toLowerCase() : null,
    assigned_reg: f.reg_number ?? null,
    aircraft_type: f.aircraft_icao ?? null,
    airline_iata: f.airline_iata ?? null,
    airline_icao: f.airline_icao ?? null,
    source: 'airlabs'
  };
}

function parseUtc(s: string | undefined): number | null {
  if (!s) return null;
  const iso = s.replace(' ', 'T');
  const t = Date.parse(iso.endsWith('Z') ? iso : iso + 'Z');
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function mapStatus(s: string | undefined): ResolvedFlight['status'] {
  const x = (s ?? '').toLowerCase();
  if (x === 'cancelled') return 'cancelled';
  if (x === 'diverted') return 'diverted';
  if (x === 'landed') return 'landed';
  if (x === 'en-route' || x === 'enroute' || x === 'active') return 'airborne';
  if (x === 'scheduled') return 'scheduled';
  return 'unknown';
}
