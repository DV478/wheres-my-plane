import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';

const URL_V1 = 'https://nasstatus.faa.gov/api/airport-status-information';

const DELAY_PRG = z.object({
  AirportClosure: z.unknown().optional(),
  Arrival: z
    .object({
      Delay: z
        .object({
          Min: z.string().optional(),
          Max: z.string().optional(),
          Trend: z.string().optional()
        })
        .optional(),
      Reason: z.string().optional()
    })
    .optional(),
  Departure: z
    .object({
      Delay: z
        .object({
          Min: z.string().optional(),
          Max: z.string().optional(),
          Trend: z.string().optional()
        })
        .optional(),
      Reason: z.string().optional()
    })
    .optional()
});

const FAA_RESPONSE = z.object({
  AIRPORT: z
    .union([
      z.array(z.object({ ARPT: z.string(), Delay: z.string().optional() })),
      z.object({ ARPT: z.string() })
    ])
    .optional()
});

export interface FaaEnv {
  CACHE: KVNamespace;
}

export interface UsAirportDelay {
  iata: string;
  delayed: boolean;
  reason: string | null;
  avgDelayMin: number | null;
}

export async function getUsAirportDelays(env: FaaEnv): Promise<UsAirportDelay[]> {
  try {
    const data = await httpJson<unknown>(
      URL_V1,
      { headers: { Accept: 'application/json' } },
      { kv: env.CACHE, cacheKey: 'faa:nas:v1', ttlSec: 300, source: 'faa-nas' }
    );
    const parsed = FAA_RESPONSE.safeParse(data);
    if (!parsed.success) return [];
    const rows = parsed.data.AIRPORT;
    if (!rows) return [];
    const list = Array.isArray(rows) ? rows : [rows];
    return list.map((r: { ARPT: string; Delay?: string }) => ({
      iata: r.ARPT,
      delayed: /Y|true|1/i.test(r.Delay ?? ''),
      reason: null,
      avgDelayMin: null
    }));
  } catch {
    return [];
  }
}

export { DELAY_PRG };
