import type { KVNamespace } from '@cloudflare/workers-types';
import { AppError, isAppError } from '$lib/errors';
import { log } from '$lib/log';
import * as aerodatabox from '../providers/aerodatabox';
import * as airlabs from '../providers/airlabs';
import * as aviationstack from '../providers/aviationstack';
import type { ResolvedFlight } from './types';

export interface ResolveEnv {
  CACHE: KVNamespace;
  AERODATABOX_RAPIDAPI_KEY?: string;
  AIRLABS_KEY?: string;
  AVIATIONSTACK_KEY?: string;
}

export async function resolveFlight(
  env: ResolveEnv,
  flightNo: string,
  isoDate: string
): Promise<ResolvedFlight> {
  const attempts: Array<() => Promise<ResolvedFlight | null>> = [];

  if (env.AERODATABOX_RAPIDAPI_KEY) {
    attempts.push(() =>
      aerodatabox.getFlight(
        { AERODATABOX_RAPIDAPI_KEY: env.AERODATABOX_RAPIDAPI_KEY!, CACHE: env.CACHE },
        flightNo,
        isoDate
      )
    );
  }
  if (env.AIRLABS_KEY) {
    attempts.push(() =>
      airlabs.getFlight({ AIRLABS_KEY: env.AIRLABS_KEY!, CACHE: env.CACHE }, flightNo, isoDate)
    );
  }
  if (env.AVIATIONSTACK_KEY) {
    attempts.push(() =>
      aviationstack.getFlight(
        { AVIATIONSTACK_KEY: env.AVIATIONSTACK_KEY!, CACHE: env.CACHE },
        flightNo,
        isoDate
      )
    );
  }

  if (attempts.length === 0) {
    throw new AppError({
      code: 'no_providers_configured',
      status: 500,
      publicMessage: 'No flight data provider is configured. Set at least one API key.'
    });
  }

  let lastErr: unknown = null;
  for (const run of attempts) {
    try {
      const result = await run();
      if (result) return result;
    } catch (err) {
      if (isAppError(err) && (err.code === 'provider_cooldown' || err.code === 'provider_retryable')) {
        log.warn('resolve.fallback', { code: err.code });
        lastErr = err;
        continue;
      }
      lastErr = err;
      log.warn('resolve.error', { err: String(err) });
    }
  }

  throw new AppError({
    code: 'flight_not_found',
    status: 404,
    publicMessage: `Could not find flight ${flightNo} on ${isoDate}.`,
    cause: lastErr
  });
}
