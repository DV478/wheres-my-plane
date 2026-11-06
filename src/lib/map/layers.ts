import { ScatterplotLayer, IconLayer, ArcLayer, PathLayer } from '@deck.gl/layers';

export interface Aircraft {
  hex: string;
  reg: string | null;
  type: string | null;
  callsign: string | null;
  lat: number;
  lon: number;
  alt_ft: number | null;
  gs_kt: number | null;
  heading: number | null;
}

export interface TrackPoint {
  hex: string;
  lat: number;
  lon: number;
  ts: number;
}

export interface ScheduledArc {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  flightNo: string;
}

export function trafficScatterLayer(
  aircraft: Aircraft[],
  onClick: (a: Aircraft) => void
): ScatterplotLayer<Aircraft> {
  return new ScatterplotLayer<Aircraft>({
    id: 'traffic-scatter',
    data: aircraft,
    pickable: true,
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    getPosition: (d) => [d.lon, d.lat, altToM(d.alt_ft)],
    getRadius: 3,
    getFillColor: altColour,
    getLineColor: [15, 20, 30, 220],
    lineWidthUnits: 'pixels',
    getLineWidth: 0.5,
    onClick: (info) => {
      if (info.object) onClick(info.object as Aircraft);
    }
  });
}

export function trafficIconLayer(
  aircraft: Aircraft[],
  onClick: (a: Aircraft) => void
): IconLayer<Aircraft> {
  return new IconLayer<Aircraft>({
    id: 'traffic-icons',
    data: aircraft,
    pickable: true,
    getIcon: () => ({
      url:
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#f7faff" stroke="#0b1220" stroke-width="1" d="M12 2 L14 11 L22 13 L14 14 L12 22 L10 14 L2 13 L10 11 Z"/></svg>'
        ),
      width: 48,
      height: 48,
      anchorY: 24
    }),
    sizeUnits: 'pixels',
    getSize: 18,
    getPosition: (d) => [d.lon, d.lat],
    getAngle: (d) => (d.heading ?? 0) * -1,
    onClick: (info) => {
      if (info.object) onClick(info.object as Aircraft);
    }
  });
}

export function trackPathLayer(points: TrackPoint[]): PathLayer {
  if (points.length === 0) return new PathLayer({ id: 'track-empty', data: [] });
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const path: [number, number][] = sorted.map((p) => [p.lon, p.lat]);
  return new PathLayer<{ path: [number, number][] }>({
    id: 'track-path',
    data: [{ path }],
    getPath: (d) => d.path,
    getColor: [255, 196, 64, 200],
    widthUnits: 'pixels',
    getWidth: 2
  });
}

export function scheduledArcLayer(arcs: ScheduledArc[]): ArcLayer<ScheduledArc> {
  return new ArcLayer<ScheduledArc>({
    id: 'scheduled-arc',
    data: arcs,
    pickable: true,
    getSourcePosition: (d) => [d.originLon, d.originLat],
    getTargetPosition: (d) => [d.destLon, d.destLat],
    getSourceColor: [96, 180, 255, 180],
    getTargetColor: [255, 196, 64, 180],
    getWidth: 1.5,
    greatCircle: true
  });
}

function altToM(ftMaybe: number | null): number {
  if (!ftMaybe) return 0;
  return ftMaybe * 0.3048;
}

function altColour(d: Aircraft): [number, number, number, number] {
  const ft = d.alt_ft ?? 0;
  if (ft < 5_000) return [255, 160, 96, 220];
  if (ft < 20_000) return [255, 224, 128, 220];
  if (ft < 35_000) return [128, 255, 192, 220];
  return [128, 200, 255, 220];
}
