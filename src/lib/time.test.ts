import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import { parseRelativeDate, renderDual, todayIsoInTz } from './time';

describe('parseRelativeDate', () => {
  const fixedNow = DateTime.fromISO('2026-11-04T10:00:00Z', { zone: 'utc' });

  test('today', () => {
    expect(parseRelativeDate('today', 'Europe/London', fixedNow)).toBe('2026-11-04');
  });

  test('tomorrow', () => {
    expect(parseRelativeDate('tomorrow', 'Europe/London', fixedNow)).toBe('2026-11-05');
  });

  test('tmrw shorthand', () => {
    expect(parseRelativeDate('tmrw', 'Europe/London', fixedNow)).toBe('2026-11-05');
  });

  test('in N days', () => {
    expect(parseRelativeDate('in 3 days', 'Europe/London', fixedNow)).toBe('2026-11-07');
    expect(parseRelativeDate('in 1 day', 'Europe/London', fixedNow)).toBe('2026-11-05');
  });

  test('absolute ISO', () => {
    expect(parseRelativeDate('2026-12-25', 'Europe/London', fixedNow)).toBe('2026-12-25');
  });

  test('unparseable returns null', () => {
    expect(parseRelativeDate('whenever', 'Europe/London', fixedNow)).toBeNull();
  });
});

describe('renderDual', () => {
  test('same offset renders single entry', () => {
    const utcSec = Math.floor(DateTime.fromISO('2026-11-04T12:00:00Z').toSeconds());
    const out = renderDual(utcSec, 'Europe/London', 'Europe/London');
    expect(out).toContain('12:00');
    expect(out.includes('·')).toBe(false);
  });

  test('different offset renders dual entry', () => {
    const utcSec = Math.floor(DateTime.fromISO('2026-11-04T12:00:00Z').toSeconds());
    const out = renderDual(utcSec, 'Asia/Singapore', 'Europe/London');
    expect(out).toContain('20:00');
    expect(out).toContain('12:00');
    expect(out.includes('·')).toBe(true);
  });
});

describe('todayIsoInTz', () => {
  test('returns ISO date for a valid tz', () => {
    expect(todayIsoInTz('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
