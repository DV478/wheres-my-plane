import { DateTime } from 'luxon';

export function fromUnixSec(sec: number): DateTime {
  return DateTime.fromSeconds(sec, { zone: 'utc' });
}

export function renderInTz(utcSec: number, tz: string): string {
  return fromUnixSec(utcSec).setZone(tz).toFormat('HH:mm');
}

export function renderDual(utcSec: number, airportTz: string, homeTz: string): string {
  const airport = fromUnixSec(utcSec).setZone(airportTz);
  const home = fromUnixSec(utcSec).setZone(homeTz);
  const airportStr = `${airport.toFormat('HH:mm')} ${airport.toFormat('ZZZZ')}`;
  if (airport.offset === home.offset) return airportStr;
  const homeStr = `${home.toFormat('HH:mm')} ${home.toFormat('ZZZZ')}`;
  return `${airportStr} · ${homeStr}`;
}

export function renderDate(utcSec: number, tz: string): string {
  return fromUnixSec(utcSec).setZone(tz).toFormat('ccc d LLL');
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function todayIsoInTz(tz: string): string {
  return DateTime.now().setZone(tz).toISODate() ?? DateTime.utc().toISODate() ?? '';
}

export function isoDateToUtcDayStart(isoDate: string, tz: string): number {
  const dt = DateTime.fromISO(isoDate, { zone: tz });
  return Math.floor(dt.toSeconds());
}

export function parseRelativeDate(input: string, tz: string, now: DateTime = DateTime.now()): string | null {
  const base = now.setZone(tz).startOf('day');
  const s = input.trim().toLowerCase();
  if (s === 'today') return base.toISODate();
  if (s === 'tomorrow' || s === 'tmrw') return base.plus({ days: 1 }).toISODate();
  const m = /^in\s+(\d+)\s+day(s)?$/.exec(s);
  if (m) return base.plus({ days: parseInt(m[1], 10) }).toISODate();
  const iso = DateTime.fromISO(input, { zone: tz });
  if (iso.isValid) return iso.toISODate();
  return null;
}
