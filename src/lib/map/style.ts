export interface StyleOpts {
  tileUrl: string;
  attribution?: string;
}

export function darkStyle(opts: StyleOpts): object {
  const { tileUrl } = opts;
  const attribution =
    opts.attribution ?? '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://protomaps.com">Protomaps</a>';
  const source = tileUrlToSource(tileUrl, attribution);
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: { protomaps: source },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0c1426' } },
      {
        id: 'earth',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        paint: { 'fill-color': '#182239' }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': '#0a1322' }
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#1f2a44', 'fill-opacity': 0.35 }
      },
      {
        id: 'roads-minor',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['!in', 'kind', 'highway', 'major_road'],
        minzoom: 11,
        paint: { 'line-color': '#223055', 'line-width': 0.6 }
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'highway', 'major_road'],
        paint: { 'line-color': '#3a4b7a', 'line-width': 1.2 }
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'boundaries',
        paint: { 'line-color': '#5a6a9a', 'line-dasharray': [2, 2], 'line-width': 0.8 }
      },
      {
        id: 'places',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11
        },
        paint: { 'text-color': '#c9d4ea', 'text-halo-color': '#0b1220', 'text-halo-width': 1 }
      }
    ]
  };
}

function tileUrlToSource(url: string, attribution: string) {
  // If the URL is a TileJSON endpoint, use `url:` so MapLibre fetches the
  // vector_layers metadata (needed in MapLibre 3+ for filter type-checking).
  // If it's a tile template with {z}/{x}/{y}, derive the TileJSON URL from it.
  const tileJsonUrl = url.includes('{z}')
    ? deriveTileJsonUrl(url)
    : url;
  return {
    type: 'vector' as const,
    url: tileJsonUrl,
    attribution
  };
}

function deriveTileJsonUrl(templateUrl: string): string {
  // Protomaps pattern: .../tiles/v4/{z}/{x}/{y}.mvt?key=... → .../tiles/v4.json?key=...
  // Use string replace, not URL parsing — new URL() encodes {} which breaks the pattern.
  return templateUrl.replace(/\/v(\d+)\/\{z\}\/\{x\}\/\{y\}\.mvt/, '/v$1.json');
}

export const MAP_ATTRIBUTIONS = [
  '© OpenStreetMap contributors',
  '© Protomaps',
  'adsb.lol (ODbL)',
  'OpenSky Network (non-commercial)'
];
