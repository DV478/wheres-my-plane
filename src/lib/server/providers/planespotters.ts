import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';
import { httpJson } from '../http';
import type { AircraftPhoto } from '../flights/types';

const BASE = 'https://api.planespotters.net/pub/photos';

const PS_RESPONSE = z.object({
  photos: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).optional(),
        thumbnail_large: z.object({ src: z.string() }).optional(),
        thumbnail: z.object({ src: z.string() }).optional(),
        photographer: z.string(),
        link: z.string()
      })
    )
    .optional()
});

export interface PlanespottersEnv {
  CACHE: KVNamespace;
}

export async function getPhotoByReg(
  env: PlanespottersEnv,
  reg: string
): Promise<AircraftPhoto | null> {
  return fetchOne(env, `${BASE}/reg/${encodeURIComponent(reg)}`, `planespotters:reg:${reg}`);
}

export async function getPhotoByHex(
  env: PlanespottersEnv,
  hex: string
): Promise<AircraftPhoto | null> {
  return fetchOne(env, `${BASE}/hex/${encodeURIComponent(hex)}`, `planespotters:hex:${hex}`);
}

async function fetchOne(
  env: PlanespottersEnv,
  url: string,
  cacheKey: string
): Promise<AircraftPhoto | null> {
  const data = await httpJson<unknown>(
    url,
    {},
    { kv: env.CACHE, cacheKey, ttlSec: 604800, source: 'planespotters' }
  );
  const parsed = PS_RESPONSE.safeParse(data);
  if (!parsed.success) return null;
  const photo = parsed.data.photos?.[0];
  if (!photo) return null;

  const main = photo.thumbnail_large?.src ?? photo.thumbnail?.src ?? null;
  if (!main) return null;

  return {
    url: main,
    thumbnail: photo.thumbnail?.src ?? null,
    photographer: photo.photographer,
    link: photo.link
  };
}
