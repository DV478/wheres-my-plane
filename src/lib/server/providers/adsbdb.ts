import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { AircraftRecord } from '../flights/types';

const BASE = 'https://api.adsbdb.com/v0';

const ADSBDB_RESPONSE = z.object({
  response: z
    .object({
      aircraft: z
        .object({
          type: z.string().optional(),
          icao_type: z.string().optional(),
          manufacturer: z.string().optional(),
          mode_s: z.string().optional(),
          registration: z.string().optional(),
          registered_owner: z.string().optional()
        })
        .optional()
    })
    .optional()
});

export interface AdsbdbEnv {
  CACHE: KVNamespace;
}

export async function getAircraftByHex(
  env: AdsbdbEnv,
  hex: string
): Promise<Partial<AircraftRecord> | null> {
  const key = hex.toLowerCase();
  const data = await httpJson<unknown>(
    `${BASE}/aircraft/${encodeURIComponent(key)}`,
    {},
    { kv: env.CACHE, cacheKey: `adsbdb:aircraft:${key}`, ttlSec: 86400, source: 'adsbdb' }
  );
  const parsed = ADSBDB_RESPONSE.safeParse(data);
  if (!parsed.success || !parsed.data.response?.aircraft) return null;
  const a = parsed.data.response.aircraft;
  return {
    hex: a.mode_s?.toLowerCase() ?? key,
    reg: a.registration ?? null,
    type_icao: a.icao_type ?? null,
    type_name: a.type ?? null,
    operator: a.registered_owner ?? null,
    first_flight_date: null,
    delivery_date: null,
    build_year: null,
    prev_regs: null,
    source: 'adsbdb'
  };
}
