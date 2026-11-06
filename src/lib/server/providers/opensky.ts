import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { Bbox } from '$lib/map/bbox';
import { bboxKey, bucket15s, isValidBbox, roundBbox } from '$lib/map/bbox';
import type { Traffic } from './adsblol';
import { AppError } from '$lib/errors';

const BASE = 'https://opensky-network.org/api';

const STATES = z.object({
  time: z.number().optional(),
  states: z
    .array(
      z.tuple([
        z.string(),
        z.string().nullable(),
        z.string().nullable(),
        z.number().nullable(),
        z.number().nullable(),
        z.number().nullable(),
        z.number().nullable(),
        z.number().nullable(),
        z.boolean().nullable(),
        z.number().nullable(),
        z.number().nullable()
      ]).rest(z.unknown())
    )
    .nullable()
    .optional()
});

export interface OpenSkyEnv {
  CACHE: KVNamespace;
  OPENSKY_USER?: string;
  OPENSKY_PASS?: string;
}

export async function getTrafficInBbox(env: OpenSkyEnv, bbox: Bbox): Promise<Traffic[]> {
  if (!isValidBbox(bbox)) {
    throw new AppError({ code: 'bad_bbox', status: 400, publicMessage: 'Invalid bbox.' });
  }
  const r = roundBbox(bbox);
  const url = `${BASE}/states/all?lamin=${r.lamin}&lamax=${r.lamax}&lomin=${r.lomin}&lomax=${r.lomax}`;
  const key = `opensky:bbox:${bboxKey(bbox)}:${bucket15s()}`;
  const headers: Record<string, string> = {};
  if (env.OPENSKY_USER && env.OPENSKY_PASS) {
    headers.Authorization = 'Basic ' + btoa(`${env.OPENSKY_USER}:${env.OPENSKY_PASS}`);
  }
  const data = await httpJson<unknown>(
    url,
    { headers },
    { kv: env.CACHE, cacheKey: key, ttlSec: 15, source: 'opensky' }
  );
  const parsed = STATES.safeParse(data);
  if (!parsed.success) return [];
  const rows = parsed.data.states ?? [];
  return rows
    .filter((s) => s[5] != null && s[6] != null)
    .map((s) => ({
      hex: (s[0] ?? '').toLowerCase(),
      reg: null,
      type: null,
      callsign: s[1]?.trim() || null,
      lat: s[6] as number,
      lon: s[5] as number,
      alt_ft: s[7] != null ? Math.round(((s[7] as number) * 3.28084)) : null,
      gs_kt: s[9] != null ? Math.round(((s[9] as number) * 1.94384)) : null,
      heading: s[10] != null ? Math.round(s[10] as number) : null,
      source: 'adsblol' as const
    }));
}
