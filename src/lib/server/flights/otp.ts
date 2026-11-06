import type { D1Database } from '@cloudflare/workers-types';

export type OtpSource =
  | 'EUROCONTROL'
  | 'BTS'
  | 'CAA'
  | 'provider'
  | 'pending'
  | 'unavailable';

export interface OtpLine {
  source: OtpSource;
  otp15: number | null;
  label: string;
}

const EU_ICAO_PREFIXES = new Set([
  'EG','EI','EH','EB','ED','EL','ET','EN','EK','EV','EY','EP','LF','LE','LG','LI','LZ','LK','LH','LJ','LD','LC','LB','LY','LR','LA','LO','LM','LQ','LS','LT','LU','LW','LX','UKBB','EV','EV'
]);

export interface OtpContext {
  db: D1Database;
  origin_iata: string | null;
  dest_iata: string | null;
  airline_iata: string | null;
  airline_icao: string | null;
}

export async function pickOtp(ctx: OtpContext): Promise<OtpLine> {
  const { db, origin_iata, dest_iata, airline_iata } = ctx;
  if (!origin_iata || !dest_iata) return unavailable();

  const originRegion = await regionForIata(db, origin_iata);
  const destRegion = await regionForIata(db, dest_iata);
  const touchesEu = originRegion === 'EU' || destRegion === 'EU';
  const touchesUs = originRegion === 'US' || destRegion === 'US';
  const touchesUk = originRegion === 'UK' || destRegion === 'UK';

  if (touchesEu) {
    const row = await db
      .prepare(
        `SELECT otp15, source FROM routes_otp
         WHERE origin=?1 AND dest=?2 AND source='EUROCONTROL'
         ORDER BY month DESC LIMIT 1`
      )
      .bind(origin_iata, dest_iata)
      .first<{ otp15: number; source: string }>()
      .catch(() => null);
    if (row && row.otp15 != null) {
      return { source: 'EUROCONTROL', otp15: row.otp15, label: fmt('EUROCONTROL', row.otp15) };
    }
  }

  if (touchesUs && airline_iata) {
    const row = await db
      .prepare(
        `SELECT otp15 FROM routes_otp
         WHERE origin=?1 AND dest=?2 AND carrier=?3 AND source='BTS'
         ORDER BY month DESC LIMIT 1`
      )
      .bind(origin_iata, dest_iata, airline_iata)
      .first<{ otp15: number }>()
      .catch(() => null);
    if (row && row.otp15 != null) {
      return { source: 'BTS', otp15: row.otp15, label: fmt('BTS', row.otp15) };
    }
  }

  if (touchesUk) {
    const row = await db
      .prepare(
        `SELECT otp15 FROM routes_otp
         WHERE origin=?1 AND dest=?2 AND source='CAA'
         ORDER BY month DESC LIMIT 1`
      )
      .bind(origin_iata, dest_iata)
      .first<{ otp15: number }>()
      .catch(() => null);
    if (row && row.otp15 != null) {
      return { source: 'CAA', otp15: row.otp15, label: fmt('CAA', row.otp15) };
    }
  }

  // Phase 1 falls through here. Provider stats + own-history populate in later phases.
  return {
    source: 'pending',
    otp15: null,
    label: 'Punctuality feeds arrive in Phase 3.'
  };
}

function unavailable(): OtpLine {
  return { source: 'unavailable', otp15: null, label: 'Route unknown — no punctuality data.' };
}

function fmt(source: string, otp15: number): string {
  return `${source}: ${otp15.toFixed(0)}% on time (≤15 min) last reported month.`;
}

async function regionForIata(db: D1Database, iata: string): Promise<'EU' | 'US' | 'UK' | 'OTHER'> {
  const row = await db
    .prepare('SELECT country, icao FROM airports WHERE iata=?1 LIMIT 1')
    .bind(iata)
    .first<{ country: string | null; icao: string | null }>()
    .catch(() => null);
  const country = row?.country ?? '';
  if (country === 'GB' || country === 'UK') return 'UK';
  if (country === 'US') return 'US';
  const icaoPrefix = (row?.icao ?? '').slice(0, 2);
  if (EU_ICAO_PREFIXES.has(icaoPrefix)) return 'EU';
  return 'OTHER';
}
