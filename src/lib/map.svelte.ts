import type { Aircraft } from './map/layers';
import type { Bbox } from './map/bbox';

interface MapState {
  aircraft: Aircraft[];
  selected: Aircraft | null;
  source: string | null;
  loading: boolean;
  lastFetchedAt: number;
  error: string | null;
  showTraffic: boolean;
  showArcs: boolean;
}

const state = $state<MapState>({
  aircraft: [],
  selected: null,
  source: null,
  loading: false,
  lastFetchedAt: 0,
  error: null,
  showTraffic: true,
  showArcs: true
});

export const mapState = state;

let inFlight: AbortController | null = null;

export async function fetchTraffic(bbox: Bbox): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (inFlight) inFlight.abort();
  inFlight = new AbortController();
  state.loading = true;
  state.error = null;
  try {
    const params = new URLSearchParams({
      lamin: String(bbox.lamin),
      lamax: String(bbox.lamax),
      lomin: String(bbox.lomin),
      lomax: String(bbox.lomax)
    });
    const res = await fetch(`/api/traffic?${params}`, { signal: inFlight.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { ok: boolean; source: string | null; aircraft: Aircraft[]; note?: string } =
      await res.json();
    state.aircraft = data.aircraft;
    state.source = data.source;
    state.lastFetchedAt = Date.now();
    if (!data.ok) state.error = data.note ?? 'Live data unavailable';
  } catch (err) {
    if ((err as Error).name !== 'AbortError') state.error = String(err);
  } finally {
    state.loading = false;
    inFlight = null;
  }
}

export function selectAircraft(a: Aircraft | null): void {
  state.selected = a;
}

export function toggleTraffic(): void {
  state.showTraffic = !state.showTraffic;
}

export function toggleArcs(): void {
  state.showArcs = !state.showArcs;
}
