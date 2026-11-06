import type { KVNamespace } from '@cloudflare/workers-types';
import { AppError } from '$lib/errors';

const CLOCK_SKEW_SEC = 600;
const NONCE_TTL_SEC = 1800;

export interface VerifyIngestInput {
  rawBody: string;
  signatureHeader: string | null;
  nonceHeader: string | null;
  timestampHeader: string | null;
  secret: string;
  kv: KVNamespace;
  now?: number;
}

export async function verifyIngest(input: VerifyIngestInput): Promise<void> {
  const { rawBody, signatureHeader, nonceHeader, timestampHeader, secret, kv } = input;
  const now = input.now ?? Math.floor(Date.now() / 1000);

  if (!signatureHeader || !nonceHeader || !timestampHeader) {
    throw new AppError({ code: 'hmac_missing_headers', status: 401, publicMessage: 'Missing signature headers.' });
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > CLOCK_SKEW_SEC) {
    throw new AppError({ code: 'hmac_clock_skew', status: 401, publicMessage: 'Timestamp outside tolerated window.' });
  }

  const expected = await hmacHex(secret, rawBody);
  const provided = signatureHeader.replace(/^sha256=/, '');
  if (!timingSafeEqualHex(expected, provided)) {
    throw new AppError({ code: 'hmac_bad_signature', status: 401, publicMessage: 'Invalid signature.' });
  }

  const nonceKey = `nonce:${nonceHeader}`;
  const seen = await kv.get(nonceKey);
  if (seen) {
    throw new AppError({ code: 'hmac_replay', status: 401, publicMessage: 'Nonce already seen.' });
  }
  await kv.put(nonceKey, '1', { expirationTtl: NONCE_TTL_SEC });
}

export async function signPayload(secret: string, body: string): Promise<string> {
  const hex = await hmacHex(secret, body);
  return `sha256=${hex}`;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return bytesToHex(new Uint8Array(sig));
}

function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (const v of b) s += v.toString(16).padStart(2, '0');
  return s;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
