import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';

const BASE = 'https://aviationweather.gov/api/data';

const METAR_ROW = z.object({
  icaoId: z.string(),
  reportTime: z.string().optional(),
  temp: z.number().nullable().optional(),
  dewp: z.number().nullable().optional(),
  wdir: z.union([z.number(), z.string()]).nullable().optional(),
  wspd: z.number().nullable().optional(),
  wgst: z.number().nullable().optional(),
  visib: z.union([z.number(), z.string()]).nullable().optional(),
  altim: z.number().nullable().optional(),
  wxString: z.string().nullable().optional(),
  rawOb: z.string().optional()
});

export interface AvWxEnv {
  CACHE: KVNamespace;
}

export interface MetarRow {
  icao: string;
  rawObservation: string | null;
  windDir: number | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  visibility: string | null;
  tempC: number | null;
  reportedAt: string | null;
}

export async function getMetar(env: AvWxEnv, icaoIds: string[]): Promise<MetarRow[]> {
  const ids = icaoIds.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (ids.length === 0) return [];
  const idsParam = ids.join(',');
  const url = `${BASE}/metar?ids=${encodeURIComponent(idsParam)}&format=json&taf=false`;
  const data = await httpJson<unknown>(
    url,
    {},
    { kv: env.CACHE, cacheKey: `avwx:metar:${idsParam}`, ttlSec: 300, source: 'aviationweather' }
  );
  const parsed = z.array(METAR_ROW).safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.map((r) => ({
    icao: r.icaoId,
    rawObservation: r.rawOb ?? null,
    windDir: typeof r.wdir === 'number' ? r.wdir : null,
    windSpeedKt: r.wspd ?? null,
    windGustKt: r.wgst ?? null,
    visibility: r.visib != null ? String(r.visib) : null,
    tempC: r.temp ?? null,
    reportedAt: r.reportTime ?? null
  }));
}
