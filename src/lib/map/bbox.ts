export interface Bbox {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

const GRID_DEG = 0.5;

export function roundBbox(b: Bbox): Bbox {
  return {
    lamin: Math.max(-90, floorTo(b.lamin, GRID_DEG)),
    lamax: Math.min(90, ceilTo(b.lamax, GRID_DEG)),
    lomin: floorTo(normaliseLon(b.lomin), GRID_DEG),
    lomax: ceilTo(normaliseLon(b.lomax), GRID_DEG)
  };
}

export function bboxKey(b: Bbox): string {
  const r = roundBbox(b);
  return `${fmt(r.lamin)},${fmt(r.lamax)},${fmt(r.lomin)},${fmt(r.lomax)}`;
}

export function bucket15s(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 15_000);
}

export function isValidBbox(b: Bbox): boolean {
  return (
    Number.isFinite(b.lamin) &&
    Number.isFinite(b.lamax) &&
    Number.isFinite(b.lomin) &&
    Number.isFinite(b.lomax) &&
    b.lamin >= -90 &&
    b.lamax <= 90 &&
    b.lamin < b.lamax &&
    b.lomin >= -180 &&
    b.lomax <= 180 &&
    b.lomin < b.lomax
  );
}

function floorTo(v: number, step: number): number {
  return Math.floor(v / step) * step;
}

function ceilTo(v: number, step: number): number {
  return Math.ceil(v / step) * step;
}

function normaliseLon(v: number): number {
  let x = v;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

function fmt(v: number): string {
  return v.toFixed(1);
}
