import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { ResolvedFlight } from '../flights/types';

const BASE = 'https://aerodatabox.p.rapidapi.com';

const ADBX_FLIGHT = z.object({
  number: z.string().optional(),
  callSign: z.string().optional(),
  status: z.string().optional(),
  aircraft: z
    .object({
      reg: z.string().optional(),
      modeS: z.string().optional(),
      model: z.string().optional()
    })
    .optional(),
  airline: z
    .object({
      iata: z.string().optional(),
      icao: z.string().optional()
    })
    .optional(),
  departure: z
    .object({
      airport: z
        .object({
          iata: z.string().optional(),
          icao: z.string().optional(),
          timeZone: z.string().optional()
        })
        .optional(),
      scheduledTime: z.object({ utc: z.string().optional() }).optional()
    })
    .optional(),
  arrival: z
    .object({
      airport: z.object({ iata: z.string().optional() }).optional(),
      scheduledTime: z.object({ utc: z.string().optional() }).optional()
    })
    .optional()
});
type ADBXFlight = z.infer<typeof ADBX_FLIGHT>;

export interface AerodataboxEnv {
  AERODATABOX_RAPIDAPI_KEY: string;
  CACHE: KVNamespace;
}

export async function getFlight(
  env: AerodataboxEnv,
  flightNo: string,
  isoDate: string
): Promise<ResolvedFlight | null> {
  const url = `${BASE}/flights/number/${encodeURIComponent(flightNo)}/${isoDate}`;
  const cacheKey = `aerodatabox:flight:${flightNo}:${isoDate}`;

  const data = await httpJson<ADBXFlight[]>(
    url,
    {
      headers: {
        'X-RapidAPI-Key': env.AERODATABOX_RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      }
    },
    { kv: env.CACHE, cacheKey, ttlSec: 300, source: 'aerodatabox' }
  );

  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;

  const parsed = ADBX_FLIGHT.safeParse(first);
  if (!parsed.success) return null;
  const f = parsed.data;

  return {
    flight_no: (f.number ?? flightNo).replace(/\s+/g, ''),
    flight_date: isoDate,
    origin_iata: f.departure?.airport?.iata ?? null,
    dest_iata: f.arrival?.airport?.iata ?? null,
    sched_dep_utc: parseUtc(f.departure?.scheduledTime?.utc),
    sched_arr_utc: parseUtc(f.arrival?.scheduledTime?.utc),
    status: mapStatus(f.status),
    assigned_hex: f.aircraft?.modeS ? f.aircraft.modeS.toLowerCase() : null,
    assigned_reg: f.aircraft?.reg ?? null,
    aircraft_type: f.aircraft?.model ?? null,
    airline_iata: f.airline?.iata ?? null,
    airline_icao: f.airline?.icao ?? null,
    source: 'aerodatabox'
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
  if (x.includes('cancel')) return 'cancelled';
  if (x.includes('divert')) return 'diverted';
  if (x.includes('arriv') || x.includes('landed')) return 'landed';
  if (x.includes('en route') || x.includes('airborne') || x.includes('flight')) return 'airborne';
  if (x.includes('board')) return 'boarding';
  if (x.includes('sched') || x.includes('expected')) return 'scheduled';
  return 'unknown';
}
