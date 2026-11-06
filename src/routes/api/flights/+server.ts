import { error, json, type RequestHandler } from '@sveltejs/kit';
import { AppError } from '$lib/errors';
import { createFlight } from '$lib/server/flights/create';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const env = platform?.env;
  if (!env?.DB || !env?.CACHE) throw error(500, 'Infrastructure unavailable');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body.');
  }

  const b = (body ?? {}) as {
    text?: unknown;
    flight_no?: unknown;
    flight_date?: unknown;
    paid_price_gbp?: unknown;
  };

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
        text: typeof b.text === 'string' ? b.text : undefined,
        flight_no: typeof b.flight_no === 'string' ? b.flight_no : undefined,
        flight_date: typeof b.flight_date === 'string' ? b.flight_date : undefined,
        paid_price_gbp: typeof b.paid_price_gbp === 'number' ? b.paid_price_gbp : null,
        homeTz: locals.user.homeTz ?? 'Europe/London'
      }
    );
    return json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AppError) {
      return json(err.toJSON(), { status: err.status });
    }
    throw err;
  }
};
