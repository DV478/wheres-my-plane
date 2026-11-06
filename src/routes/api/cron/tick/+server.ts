import { error, json, type RequestHandler } from '@sveltejs/kit';
import { tickOnce } from '$lib/server/scheduler';
import { log } from '$lib/log';

// Called every minute by Cloudflare Pages cron (or an external scheduler
// hitting this URL with the shared secret). Idempotent: an advisory KV lock
// in `tickOnce` prevents overlapping runs.
export const POST: RequestHandler = async ({ request, platform }) => {
  const env = platform?.env;
  if (!env?.DB || !env?.CACHE) throw error(500, 'Infrastructure unavailable');
  if (!env.WMP_CRON_SECRET) throw error(503, 'Cron not configured.');

  const auth = request.headers.get('x-wmp-cron-secret');
  if (auth !== env.WMP_CRON_SECRET) throw error(401, 'Bad cron secret.');

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
    log.warn('cron.tick.err', { err: String(err) });
    throw error(500, 'Tick failed.');
  }
};
