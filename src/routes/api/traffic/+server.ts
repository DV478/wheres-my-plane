import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getTrafficInBbox as adsblol } from '$lib/server/providers/adsblol';
import { getTrafficInBbox as opensky } from '$lib/server/providers/opensky';
import type { Bbox } from '$lib/map/bbox';
import { isValidBbox } from '$lib/map/bbox';
import { log } from '$lib/log';

export const GET: RequestHandler = async ({ url, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const env = platform?.env;
  if (!env?.CACHE) throw error(500, 'Infrastructure unavailable');

  const bbox: Bbox = {
    lamin: Number(url.searchParams.get('lamin')),
    lamax: Number(url.searchParams.get('lamax')),
    lomin: Number(url.searchParams.get('lomin')),
    lomax: Number(url.searchParams.get('lomax'))
  };
  if (!isValidBbox(bbox)) throw error(400, 'Invalid bbox.');

  try {
    const rows = await adsblol({ CACHE: env.CACHE }, bbox);
    return json({ ok: true, source: 'adsblol', count: rows.length, aircraft: rows });
  } catch (err) {
    log.warn('traffic.adsblol.fallback', { err: String(err) });
    if (!env.OPENSKY_USER || !env.OPENSKY_PASS) {
      return json({ ok: false, source: null, count: 0, aircraft: [], note: 'live data unavailable' });
    }
    try {
      const rows = await opensky(
        { CACHE: env.CACHE, OPENSKY_USER: env.OPENSKY_USER, OPENSKY_PASS: env.OPENSKY_PASS },
        bbox
      );
      return json({ ok: true, source: 'opensky', count: rows.length, aircraft: rows });
    } catch (err2) {
      log.error('traffic.opensky.fail', { err: String(err2) });
      return json({ ok: false, source: null, count: 0, aircraft: [], note: 'live data unavailable' });
    }
  }
};
