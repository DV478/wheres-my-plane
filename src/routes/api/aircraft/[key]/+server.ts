import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getAircraftCard } from '$lib/server/aircraft';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const env = platform?.env;
  if (!env?.DB || !env?.CACHE) throw error(500, 'Infrastructure unavailable');

  const key = params.key?.trim() ?? '';
  if (!key) throw error(400, 'Missing key.');

  const isHex = /^[0-9a-fA-F]{6}$/.test(key);
  const card = await getAircraftCard(
    { DB: env.DB, CACHE: env.CACHE },
    isHex ? { hex: key } : { reg: key }
  );
  if (!card) throw error(404, 'Aircraft not found.');
  return json(card);
};
