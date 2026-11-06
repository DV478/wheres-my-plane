import { describe, expect, it } from 'vitest';
import { bboxKey, bucket15s, isValidBbox, roundBbox } from './bbox';

describe('roundBbox', () => {
  it('snaps to the 0.5° grid, expanding outward', () => {
    const r = roundBbox({ lamin: 51.1, lamax: 51.7, lomin: -0.3, lomax: 0.4 });
    expect(r).toEqual({ lamin: 51.0, lamax: 52.0, lomin: -0.5, lomax: 0.5 });
  });

  it('clamps latitude to [-90, 90]', () => {
    const r = roundBbox({ lamin: -95, lamax: 95, lomin: -10, lomax: 10 });
    expect(r.lamin).toBe(-90);
    expect(r.lamax).toBe(90);
  });

  it('is idempotent on already-snapped input', () => {
    const b = { lamin: 10, lamax: 20, lomin: -5, lomax: 5 };
    expect(roundBbox(roundBbox(b))).toEqual(roundBbox(b));
  });
});

describe('bboxKey', () => {
  it('produces identical keys for small movements within a cell', () => {
    const a = bboxKey({ lamin: 51.52, lamax: 51.56, lomin: -0.12, lomax: -0.08 });
    const b = bboxKey({ lamin: 51.53, lamax: 51.55, lomin: -0.11, lomax: -0.09 });
    expect(a).toBe(b);
  });

  it('formats to one decimal place', () => {
    expect(bboxKey({ lamin: 51, lamax: 52, lomin: -1, lomax: 1 })).toBe('51.0,52.0,-1.0,1.0');
  });
});

describe('bucket15s', () => {
  const bucketStart = Math.floor(1_700_000_000_000 / 15_000) * 15_000;

  it('returns the same bucket for timestamps within a 15-second window', () => {
    expect(bucket15s(bucketStart)).toBe(bucket15s(bucketStart + 14_999));
  });

  it('increments at a 15s boundary', () => {
    expect(bucket15s(bucketStart + 15_000)).toBe(bucket15s(bucketStart) + 1);
  });
});

describe('isValidBbox', () => {
  it('rejects swapped or NaN values', () => {
    expect(isValidBbox({ lamin: 10, lamax: 5, lomin: 0, lomax: 1 })).toBe(false);
    expect(isValidBbox({ lamin: NaN, lamax: 1, lomin: 0, lomax: 1 })).toBe(false);
    expect(isValidBbox({ lamin: -100, lamax: 10, lomin: 0, lomax: 1 })).toBe(false);
  });

  it('accepts a sensible bbox', () => {
    expect(isValidBbox({ lamin: 51, lamax: 52, lomin: -1, lomax: 1 })).toBe(true);
  });
});
