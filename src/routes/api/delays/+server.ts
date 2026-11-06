import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getUsAirportDelays } from '$lib/server/providers/faa_nas';

export const GET: RequestHandler = async ({ platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const env = platform?.env;
  if (!env?.CACHE) throw error(500, 'Infrastructure unavailable');
  const us = await getUsAirportDelays({ CACHE: env.CACHE });
  return json({ ok: true, us });
};
