import { describe, expect, it } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
import { signPayload, verifyIngest } from './hmac';

function mockKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, String(value));
    },
    async delete(key: string) {
      store.delete(key);
    }
  } as unknown as KVNamespace;
}

const SECRET = 'test-secret-do-not-use-in-prod';

async function sign(body: string) {
  return signPayload(SECRET, body);
}

describe('verifyIngest', () => {
  it('accepts a well-signed payload with a fresh nonce', async () => {
    const body = JSON.stringify({ table: 'aircraft', rows: [] });
    const sig = await sign(body);
    const now = 1_700_000_000;
    await expect(
      verifyIngest({
        rawBody: body,
        signatureHeader: sig,
        nonceHeader: 'n-1',
        timestampHeader: String(now),
        secret: SECRET,
        kv: mockKv(),
        now
      })
    ).resolves.toBeUndefined();
  });

  it('rejects tampered bodies', async () => {
    const body = JSON.stringify({ table: 'aircraft', rows: [] });
    const sig = await sign(body);
    const now = 1_700_000_000;
    await expect(
      verifyIngest({
        rawBody: body + 'x',
        signatureHeader: sig,
        nonceHeader: 'n-1',
        timestampHeader: String(now),
        secret: SECRET,
        kv: mockKv(),
        now
      })
    ).rejects.toThrow(/signature/i);
  });

  it('rejects skewed timestamps', async () => {
    const body = '{}';
    const sig = await sign(body);
    await expect(
      verifyIngest({
        rawBody: body,
        signatureHeader: sig,
        nonceHeader: 'n-1',
        timestampHeader: String(1_700_000_000 - 3600),
        secret: SECRET,
        kv: mockKv(),
        now: 1_700_000_000
      })
    ).rejects.toThrow(/window/i);
  });

  it('rejects replayed nonces', async () => {
    const body = '{}';
    const sig = await sign(body);
    const now = 1_700_000_000;
    const kv = mockKv();
    await verifyIngest({
      rawBody: body,
      signatureHeader: sig,
      nonceHeader: 'n-same',
      timestampHeader: String(now),
      secret: SECRET,
      kv,
      now
    });
    await expect(
      verifyIngest({
        rawBody: body,
        signatureHeader: sig,
        nonceHeader: 'n-same',
        timestampHeader: String(now),
        secret: SECRET,
        kv,
        now
      })
    ).rejects.toThrow(/replay|already/i);
  });

  it('rejects when headers are missing', async () => {
    await expect(
      verifyIngest({
        rawBody: '{}',
        signatureHeader: null,
        nonceHeader: 'n-1',
        timestampHeader: String(1_700_000_000),
        secret: SECRET,
        kv: mockKv(),
        now: 1_700_000_000
      })
    ).rejects.toThrow(/missing/i);
  });
});
