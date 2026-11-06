import { z } from 'zod';
import { AppError } from '$lib/errors';
import { log } from '$lib/log';
import { parseFlightNumber } from '$lib/flights/parse';
import { parseRelativeDate, todayIsoInTz } from '$lib/time';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export const NluFlight = z.object({
  flight_no: z.string(),
  flight_date: z.string()
});
export type NluFlight = z.infer<typeof NluFlight>;

const MODEL_RESPONSE = z.object({
  flight_no: z.string().nullable(),
  flight_date: z.string().nullable()
});

export interface NluEnv {
  OPENAI_API_KEY?: string;
}

export async function parseFlightIntent(
  env: NluEnv,
  input: string,
  opts: { homeTz: string; today?: string } = { homeTz: 'Europe/London' }
): Promise<NluFlight | null> {
  const local = parseLocal(input, opts.homeTz);
  if (local) return local;

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const today = opts.today ?? todayIsoInTz(opts.homeTz);
  const system =
    'You extract flight bookings. Return JSON: {"flight_no": string|null, "flight_date": "YYYY-MM-DD"|null}. ' +
    'flight_no uses airline IATA/ICAO + number with no space (e.g. BA456). If the user omits a date, return null for flight_date. ' +
    `Today in the user's timezone is ${today}.`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input }
        ]
      })
    });

    if (!res.ok) {
      log.warn('nlu.openai.not_ok', { status: res.status });
      return null;
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = MODEL_RESPONSE.safeParse(JSON.parse(content));
    if (!parsed.success) {
      log.warn('nlu.openai.bad_shape', { content });
      return null;
    }

    const flightNo = parsed.data.flight_no
      ? parseFlightNumber(parsed.data.flight_no)?.canonical ?? null
      : null;
    if (!flightNo) return null;

    const flightDate = parsed.data.flight_date ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) return null;

    return { flight_no: flightNo, flight_date: flightDate };
  } catch (err) {
    log.warn('nlu.openai.error', { err: String(err) });
    return null;
  }
}

function parseLocal(input: string, tz: string): NluFlight | null {
  const trimmed = input.trim();
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return null;

  const flight = parseFlightNumber(tokens[0]);
  if (!flight) return null;

  const rest = tokens.slice(1).join(' ');
  if (!rest) {
    return { flight_no: flight.canonical, flight_date: todayIsoInTz(tz) };
  }

  const date = parseRelativeDate(rest, tz);
  if (!date) return null;
  return { flight_no: flight.canonical, flight_date: date };
}

export function requireNlu(x: NluFlight | null): NluFlight {
  if (!x) {
    throw new AppError({
      code: 'nlu_failed',
      status: 400,
      publicMessage: 'Could not understand that as a flight. Try "BA456 tomorrow".'
    });
  }
  return x;
}
