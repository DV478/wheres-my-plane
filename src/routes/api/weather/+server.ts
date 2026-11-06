import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getMetar } from '$lib/server/providers/aviationweather';

export const GET: RequestHandler = async ({ url, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const env = platform?.env;
  if (!env?.CACHE) throw error(500, 'Infrastructure unavailable');

  const idsRaw = url.searchParams.get('ids') ?? '';
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 25);
  if (ids.length === 0) throw error(400, 'Provide ?ids=ICAO1,ICAO2 (max 25).');
  const rows = await getMetar({ CACHE: env.CACHE }, ids);
  return json({ ok: true, metars: rows });
};
