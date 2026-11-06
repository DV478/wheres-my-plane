import { describe, expect, test, vi } from 'vitest';
import { AppError } from '../../errors';
import type { ResolvedFlight } from './types';
import { resolveFlight } from './resolve';

const BA456: ResolvedFlight = {
  flight_no: 'BA456',
  flight_date: '2026-11-05',
  origin_iata: 'LHR',
  dest_iata: 'SIN',
  sched_dep_utc: 1762336200,
  sched_arr_utc: 1762382400,
  status: 'scheduled',
  assigned_hex: null,
  assigned_reg: null,
  aircraft_type: null,
  airline_iata: 'BA',
  airline_icao: 'BAW',
  source: 'aerodatabox'
};

type KV = { get(_: string): Promise<null>; put(): Promise<void>; delete(): Promise<void> };
const kv = { get: async () => null, put: async () => {}, delete: async () => {} } as unknown as KV;

describe('resolveFlight', () => {
  test('returns the first successful provider', async () => {
    const adbx = await import('../providers/aerodatabox');
    const spy = vi.spyOn(adbx, 'getFlight').mockResolvedValueOnce(BA456);
    const result = await resolveFlight(
      { CACHE: kv as never, AERODATABOX_RAPIDAPI_KEY: 'x' },
      'BA456',
      '2026-11-05'
    );
    expect(result).toEqual(BA456);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  test('falls through on cooldown to next provider', async () => {
    const adbx = await import('../providers/aerodatabox');
    const al = await import('../providers/airlabs');
    const s1 = vi.spyOn(adbx, 'getFlight').mockRejectedValueOnce(
      new AppError({ code: 'provider_cooldown', status: 503, publicMessage: '' })
    );
    const s2 = vi.spyOn(al, 'getFlight').mockResolvedValueOnce({ ...BA456, source: 'airlabs' });
    const result = await resolveFlight(
      { CACHE: kv as never, AERODATABOX_RAPIDAPI_KEY: 'x', AIRLABS_KEY: 'y' },
      'BA456',
      '2026-11-05'
    );
    expect(result.source).toBe('airlabs');
    s1.mockRestore();
    s2.mockRestore();
  });

  test('throws flight_not_found when all providers return null', async () => {
    const adbx = await import('../providers/aerodatabox');
    const al = await import('../providers/airlabs');
    const s1 = vi.spyOn(adbx, 'getFlight').mockResolvedValueOnce(null);
    const s2 = vi.spyOn(al, 'getFlight').mockResolvedValueOnce(null);
    await expect(
      resolveFlight(
        { CACHE: kv as never, AERODATABOX_RAPIDAPI_KEY: 'x', AIRLABS_KEY: 'y' },
        'XX999',
        '2026-11-05'
      )
    ).rejects.toMatchObject({ code: 'flight_not_found' });
    s1.mockRestore();
    s2.mockRestore();
  });

  test('throws no_providers_configured when no key set', async () => {
    await expect(
      resolveFlight({ CACHE: kv as never }, 'BA456', '2026-11-05')
    ).rejects.toMatchObject({ code: 'no_providers_configured' });
  });
});
