import { error, fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { AppError } from '$lib/errors';
import { log } from '$lib/log';
import { createFlight } from '$lib/server/flights/create';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  return {};
};

export const actions: Actions = {
  default: async ({ request, platform, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorised');
    const form = await request.formData();
    const text = String(form.get('text') ?? '').trim();
    const flight_no = String(form.get('flight_no') ?? '').trim();
    const flight_date = String(form.get('flight_date') ?? '').trim();
    const paidRaw = String(form.get('paid_price_gbp') ?? '').trim();
    const paid_price_gbp = paidRaw ? Number(paidRaw) : null;

    const env = platform?.env;
    if (!env?.DB || !env?.CACHE) {
      return fail(500, { text, flight_no, flight_date, error: 'Infrastructure unavailable.' });
    }

    if (!text && !flight_no && !flight_date) {
      return fail(400, {
        text,
        flight_no,
        flight_date,
        error: 'Enter "BA456 tomorrow" or fill the form.'
      });
    }

    try {
      const result = await createFlight(
        {
          DB: env.DB,
          CACHE: env.CACHE,
          AERODATABOX_RAPIDAPI_KEY: env.AERODATABOX_RAPIDAPI_KEY,
          AIRLABS_KEY: env.AIRLABS_KEY,
          AVIATIONSTACK_KEY: env.AVIATIONSTACK_KEY,
          OPENAI_API_KEY: env.OPENAI_API_KEY
        },
        {
          userId: locals.user.id,
          text: text || undefined,
          flight_no: flight_no || undefined,
          flight_date: flight_date || undefined,
          paid_price_gbp: Number.isFinite(paid_price_gbp) ? paid_price_gbp : null,
          homeTz: locals.user.homeTz ?? 'Europe/London'
        }
      );
      throw redirect(303, `/app/flights/${result.id}`);
    } catch (err) {
      if (isRedirect(err)) throw err;
      if (err instanceof Response) throw err;
      if (err instanceof AppError) {
        log.warn('flights.create.app_error', { code: err.code });
        return fail(err.status, { text, flight_no, flight_date, error: err.publicMessage });
      }
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err);
      log.error('flights.create.unknown', { detail, stack: err instanceof Error ? err.stack : null });
      return fail(500, {
        text,
        flight_no,
        flight_date,
        error: `Something went wrong: ${detail}`
      });
    }
  }
};

