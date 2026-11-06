import type { ResolvedFlight } from '../flights/types';

// `t-1`: last check snapshot stored on flight_checks.
// `t`:   resolved flight just fetched.
export interface LastKnown {
  last_status: string | null;
  last_assigned_hex: string | null;
  last_assigned_reg: string | null;
  last_sched_dep_utc: number | null;
}

export type MaterialChange =
  | { kind: 'tail_assigned'; reg: string | null; hex: string | null }
  | { kind: 'delay_change'; from_utc: number | null; to_utc: number | null; delta_min: number }
  | { kind: 'cancelled' }
  | { kind: 'diverted' }
  | { kind: 'status_change'; from: string; to: string }
  | { kind: 'reg_change'; from_reg: string | null; to_reg: string | null };

const DELAY_THRESHOLD_SEC = 10 * 60; // ignore noise < 10 min

export function diffFlight(prev: LastKnown, next: ResolvedFlight): MaterialChange[] {
  const changes: MaterialChange[] = [];

  // Terminal statuses first — if we hit these, they're the only thing that matters.
  if (next.status === 'cancelled' && prev.last_status !== 'cancelled') {
    changes.push({ kind: 'cancelled' });
    return changes;
  }
  if (next.status === 'diverted' && prev.last_status !== 'diverted') {
    changes.push({ kind: 'diverted' });
    return changes;
  }

  // Tail assignment: null → something.
  if (!prev.last_assigned_hex && next.assigned_hex) {
    changes.push({
      kind: 'tail_assigned',
      reg: next.assigned_reg,
      hex: next.assigned_hex
    });
  } else if (
    prev.last_assigned_reg &&
    next.assigned_reg &&
    prev.last_assigned_reg !== next.assigned_reg
  ) {
    // Reg swap mid-cycle (rare, but a material tail change).
    changes.push({
      kind: 'reg_change',
      from_reg: prev.last_assigned_reg,
      to_reg: next.assigned_reg
    });
  }

  // Delay / time shift.
  if (
    prev.last_sched_dep_utc != null &&
    next.sched_dep_utc != null &&
    Math.abs(next.sched_dep_utc - prev.last_sched_dep_utc) >= DELAY_THRESHOLD_SEC
  ) {
    changes.push({
      kind: 'delay_change',
      from_utc: prev.last_sched_dep_utc,
      to_utc: next.sched_dep_utc,
      delta_min: Math.round((next.sched_dep_utc - prev.last_sched_dep_utc) / 60)
    });
  }

  // Non-terminal status transitions (scheduled → boarding → airborne → landed).
  if (prev.last_status && prev.last_status !== next.status) {
    changes.push({ kind: 'status_change', from: prev.last_status, to: next.status });
  }

  return changes;
}

export function describeChange(c: MaterialChange): string {
  switch (c.kind) {
    case 'tail_assigned':
      return c.reg ? `Aircraft assigned: ${c.reg}` : `Aircraft assigned (${c.hex ?? 'unknown hex'})`;
    case 'delay_change': {
      const sign = c.delta_min >= 0 ? '+' : '';
      return `Schedule shifted ${sign}${c.delta_min} min`;
    }
    case 'cancelled':
      return 'Flight cancelled.';
    case 'diverted':
      return 'Flight diverted.';
    case 'status_change':
      return `Status: ${c.from} → ${c.to}`;
    case 'reg_change':
      return `Aircraft swapped: ${c.from_reg ?? '?'} → ${c.to_reg ?? '?'}`;
  }
}
