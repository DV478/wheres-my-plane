import type { KVNamespace } from '@cloudflare/workers-types';

export async function getJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function putJson(
  kv: KVNamespace,
  key: string,
  value: unknown,
  ttlSec: number
): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSec) });
}

export async function cooldownActive(kv: KVNamespace, source: string): Promise<boolean> {
  return (await kv.get(`cooldown:${source}`)) !== null;
}

export async function markCooldown(kv: KVNamespace, source: string, ttlSec: number): Promise<void> {
  await kv.put(`cooldown:${source}`, '1', { expirationTtl: Math.max(60, ttlSec) });
}
