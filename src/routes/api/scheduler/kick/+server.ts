import { error, json, type RequestHandler } from '@sveltejs/kit';
import { tickOnce } from '$lib/server/scheduler';
import { log } from '$lib/log';

// Session-gated kick for the browser Start/Stop panel on /app.
// Keeps secrets out of client JS; session cookie is already httpOnly.
export const POST: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user) throw error(401, 'unauthorized');

  const env = platform?.env;
  if (!env?.DB || !env?.CACHE) throw error(500, 'Infrastructure unavailable');

  try {
    const result = await tickOnce({
      DB: env.DB,
      CACHE: env.CACHE,
      SESSION_SECRET: env.SESSION_SECRET,
      AERODATABOX_RAPIDAPI_KEY: env.AERODATABOX_RAPIDAPI_KEY,
      AIRLABS_KEY: env.AIRLABS_KEY,
      AVIATIONSTACK_KEY: env.AVIATIONSTACK_KEY,
      TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN
    });
    return json({ ok: true, ...result });
  } catch (err) {
    log.warn('scheduler.kick.err', { err: String(err) });
    throw error(500, 'Tick failed.');
  }
};
