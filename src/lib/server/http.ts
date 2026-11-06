import type { KVNamespace } from '@cloudflare/workers-types';
import { AppError } from '$lib/errors';
import { log } from '$lib/log';
import { cooldownActive, getJson, markCooldown, putJson } from './kv';

const USER_AGENT = 'wheres-my-plane/0.1 (+https://wheres-my-plane.pages.dev)';

export interface HttpOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | FormData;
  signal?: AbortSignal;
}

export interface CacheOpts {
  kv?: KVNamespace;
  cacheKey?: string;
  ttlSec?: number;
  source: string;
  cooldownOn?: number[];
  cooldownSec?: number;
  retries?: number;
}

export async function httpJson<T>(url: string, opts: HttpOpts, cache: CacheOpts): Promise<T> {
  const { kv, cacheKey, ttlSec, source, cooldownOn = [429], cooldownSec = 86400, retries = 2 } =
    cache;

  if (kv && cacheKey) {
    const hit = await getJson<T>(kv, cacheKey);
    if (hit !== null) {
      log.info('http.cache.hit', { source, cacheKey });
      return hit;
    }
  }

  if (kv && (await cooldownActive(kv, source))) {
    throw new AppError({
      code: 'provider_cooldown',
      status: 503,
      publicMessage: `${source} is in cooldown; try again later.`
    });
  }

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...(opts.headers ?? {})
  };
  if (opts.body && typeof opts.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body,
        signal: opts.signal
      });

      if (cooldownOn.includes(res.status) && kv) {
        await markCooldown(kv, source, cooldownSec);
        log.warn('http.cooldown', { source, status: res.status });
      }

      if (res.status === 429 || res.status >= 500) {
        lastErr = new AppError({
          code: 'provider_retryable',
          status: res.status,
          publicMessage: `${source} returned ${res.status}.`
        });
        if (attempt < retries) {
          await sleep(200 * Math.pow(2, attempt));
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AppError({
          code: 'provider_error',
          status: res.status,
          publicMessage: `${source} returned ${res.status}: ${text.slice(0, 200)}`
        });
      }

      const json = (await res.json()) as T;
      if (kv && cacheKey && ttlSec) {
        await putJson(kv, cacheKey, json, ttlSec);
      }
      log.info('http.ok', { source, status: res.status, cacheKey: cacheKey ?? null });
      return json;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      await sleep(200 * Math.pow(2, attempt));
    }
  }

  log.error('http.fail', { source, err: String(lastErr) });
  if (lastErr instanceof AppError) throw lastErr;
  throw new AppError({
    code: 'provider_unreachable',
    status: 503,
    publicMessage: `${source} is unreachable.`,
    cause: lastErr
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
