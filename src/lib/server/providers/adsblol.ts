import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { Bbox } from '$lib/map/bbox';
import { bboxKey, bucket15s, isValidBbox, roundBbox } from '$lib/map/bbox';
import { AppError } from '$lib/errors';

const BASE = 'https://api.adsb.lol/v2';

const AC = z.object({
  hex: z.string(),
  r: z.string().optional(),
  t: z.string().optional(),
  flight: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  alt_baro: z.union([z.number(), z.string()]).optional(),
  gs: z.number().optional(),
  track: z.number().optional(),
  seen: z.number().optional()
});

const AC_RESPONSE = z.object({
  ac: z.array(AC).optional(),
  now: z.number().optional()
});

export interface AdsbLolEnv {
  CACHE: KVNamespace;
}

export interface Traffic {
  hex: string;
  reg: string | null;
  type: string | null;
  callsign: string | null;
  lat: number;
  lon: number;
  alt_ft: number | null;
  gs_kt: number | null;
  heading: number | null;
  source: 'adsblol';
}

export async function getTrafficInBbox(env: AdsbLolEnv, bbox: Bbox): Promise<Traffic[]> {
  if (!isValidBbox(bbox)) {
    throw new AppError({ code: 'bad_bbox', status: 400, publicMessage: 'Invalid bbox.' });
  }
  const r = roundBbox(bbox);
  const lat = (r.lamin + r.lamax) / 2;
  const lon = (r.lomin + r.lomax) / 2;
  const diag = Math.max(r.lamax - r.lamin, r.lomax - r.lomin);
  const radiusNm = Math.min(250, Math.ceil(diag * 60));
  const key = `adsb:bbox:${bboxKey(bbox)}:${bucket15s()}`;
  const url = `${BASE}/point/${lat.toFixed(3)}/${lon.toFixed(3)}/${radiusNm}`;
  const data = await httpJson<unknown>(
    url,
    {},
    { kv: env.CACHE, cacheKey: key, ttlSec: 15, source: 'adsblol' }
  );
  const parsed = AC_RESPONSE.safeParse(data);
  if (!parsed.success) return [];
  const rows = parsed.data.ac ?? [];
  return rows
    .filter((a) => a.lat >= r.lamin && a.lat <= r.lamax && a.lon >= r.lomin && a.lon <= r.lomax)
    .map((a) => ({
      hex: a.hex.toLowerCase(),
      reg: a.r?.trim() || null,
      type: a.t?.trim() || null,
      callsign: a.flight?.trim() || null,
      lat: a.lat,
      lon: a.lon,
      alt_ft: parseAlt(a.alt_baro),
      gs_kt: a.gs != null ? Math.round(a.gs) : null,
      heading: a.track != null ? Math.round(a.track) : null,
      source: 'adsblol' as const
    }));
}

export async function getPositionByHex(env: AdsbLolEnv, hex: string): Promise<Traffic | null> {
  const key = hex.toLowerCase();
  const data = await httpJson<unknown>(
    `${BASE}/hex/${encodeURIComponent(key)}`,
    {},
    { kv: env.CACHE, cacheKey: `adsb:hex:${key}:${bucket15s()}`, ttlSec: 15, source: 'adsblol' }
  );
  const parsed = AC_RESPONSE.safeParse(data);
  if (!parsed.success) return null;
  const a = parsed.data.ac?.[0];
  if (!a) return null;
  return {
    hex: a.hex.toLowerCase(),
    reg: a.r?.trim() || null,
    type: a.t?.trim() || null,
    callsign: a.flight?.trim() || null,
    lat: a.lat,
    lon: a.lon,
    alt_ft: parseAlt(a.alt_baro),
    gs_kt: a.gs != null ? Math.round(a.gs) : null,
    heading: a.track != null ? Math.round(a.track) : null,
    source: 'adsblol' as const
  };
}

function parseAlt(v: number | string | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v);
  if (v === 'ground') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
