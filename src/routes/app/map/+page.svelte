<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onMount } from 'svelte';
  import { mapState, fetchTraffic, selectAircraft, toggleTraffic, toggleArcs } from '$lib/map.svelte';
  import { roundBbox, type Bbox } from '$lib/map/bbox';
  import { darkStyle } from '$lib/map/style';
  import {
    trafficScatterLayer,
    trafficIconLayer,
    type Aircraft
  } from '$lib/map/layers';

  let { data } = $props();

  let container: HTMLDivElement;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let cleanup: (() => void) | null = null;

  // Live refs from onMount, read by $effect.
  let mapRef = $state<unknown>(null);
  let overlayRef = $state<unknown>(null);
  let zoomRef = $state(4);

  const DEBOUNCE_MS = 1000;
  const POLL_MS = 15_000;

  onMount(() => {
    let destroyed = false;
    (async () => {
      const [{ Map: MlMap }, { MapboxOverlay }] = await Promise.all([
        import('maplibre-gl'),
        import('@deck.gl/mapbox')
      ]);
      if (destroyed) return;

      const map = new MlMap({
        container,
        style: darkStyle({ tileUrl: data.tileUrl }) as never,
        center: [-1.5, 51.5],
        zoom: 4,
        attributionControl: { compact: true }
      });

      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay as never);

      mapRef = map;
      overlayRef = overlay;

      map.on('load', () => {
        console.log('[map] loaded', { w: container.offsetWidth, h: container.offsetHeight });
        map.resize();
        void refresh();
      });
      map.on('error', (e) => console.error('[map] error', e));
      map.on('moveend', () => {
        zoomRef = map.getZoom();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void refresh(), DEBOUNCE_MS);
      });
      map.on('click', (e: { point: { x: number; y: number } }) => {
        const picked = (overlay as unknown as {
          pickObject(p: { x: number; y: number; radius?: number }): { object?: Aircraft } | null;
        }).pickObject({ x: e.point.x, y: e.point.y, radius: 8 });
        selectAircraft(picked?.object ?? null);
      });
      map.on('mousemove', (e: { point: { x: number; y: number } }) => {
        const picked = (overlay as unknown as {
          pickObject(p: { x: number; y: number; radius?: number }): { object?: Aircraft } | null;
        }).pickObject({ x: e.point.x, y: e.point.y, radius: 8 });
        map.getCanvas().style.cursor = picked?.object ? 'pointer' : '';
      });

      const onResize = () => map.resize();
      window.addEventListener('resize', onResize);
      const resizeObs = new ResizeObserver(() => map.resize());
      resizeObs.observe(container);

      async function refresh() {
        const b = map.getBounds();
        const bbox: Bbox = roundBbox({
          lamin: b.getSouth(),
          lamax: b.getNorth(),
          lomin: b.getWest(),
          lomax: b.getEast()
        });
        await fetchTraffic(bbox);
      }

      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void refresh();
      }, POLL_MS);

      cleanup = () => {
        if (pollTimer) clearInterval(pollTimer);
        if (debounceTimer) clearTimeout(debounceTimer);
        window.removeEventListener('resize', onResize);
        resizeObs.disconnect();
        map.remove();
      };
    })();
    return () => {
      destroyed = true;
      cleanup?.();
    };
  });

  $effect(() => {
    const overlay = overlayRef as { setProps(p: { layers: unknown[] }): void } | null;
    if (!overlay) return;
    const z = zoomRef;
    const aircraft = mapState.aircraft;
    const showTraffic = mapState.showTraffic;
    const ls: unknown[] = [];
    if (showTraffic) {
      const builder = z >= 7 ? trafficIconLayer : trafficScatterLayer;
      ls.push(builder(aircraft, selectAircraft));
    }
    overlay.setProps({ layers: ls });
    console.log('[map] layers rebuilt', { z, count: aircraft.length, showTraffic });
  });

  function panelAltLabel(a: Aircraft): string {
    return a.alt_ft != null ? `${a.alt_ft.toLocaleString()} ft` : '—';
  }
</script>

<svelte:head>
  <title>Map · Where's My Plane</title>
</svelte:head>

<div
  class="relative rounded-lg overflow-hidden border border-white/10"
  style="height: calc(100vh - 8rem); min-height: 600px;"
>
  <div bind:this={container} style="position: absolute; inset: 0; width: 100%; height: 100%;"></div>

  <div class="absolute top-3 left-3 flex flex-col gap-2 text-xs z-10">
    <button
      class="rounded-md border border-white/20 bg-black/60 px-3 py-1.5 hover:bg-black/80"
      class:opacity-50={!mapState.showTraffic}
      onclick={toggleTraffic}>Traffic {mapState.showTraffic ? '✓' : '·'}</button
    >
    <button
      class="rounded-md border border-white/20 bg-black/60 px-3 py-1.5 hover:bg-black/80"
      class:opacity-50={!mapState.showArcs}
      onclick={toggleArcs}>My flights {mapState.showArcs ? '✓' : '·'}</button
    >
  </div>

  <div class="absolute top-3 right-3 rounded-md border border-white/20 bg-black/60 px-3 py-1.5 text-xs z-10">
    {#if mapState.loading}
      loading…
    {:else if mapState.error}
      <span class="text-amber-300">{mapState.error}</span>
    {:else}
      {mapState.aircraft.length} aircraft · {mapState.source ?? '—'}
    {/if}
  </div>

  {#if mapState.selected}
    {@const a = mapState.selected}
    <aside
      class="absolute bottom-3 left-3 right-3 md:right-auto md:w-80 rounded-lg border border-white/15 bg-black/80 backdrop-blur p-4 text-sm z-10"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold">{a.reg ?? a.hex.toUpperCase()}</div>
          <div class="text-white/60 text-xs">
            {a.callsign ?? '—'} · {a.type ?? 'unknown type'}
          </div>
        </div>
        <button class="text-white/50 hover:text-white" onclick={() => selectAircraft(null)}>×</button>
      </div>
      <dl class="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div>
          <dt class="text-white/40">Alt</dt>
          <dd>{panelAltLabel(a)}</dd>
        </div>
        <div>
          <dt class="text-white/40">Spd</dt>
          <dd>{a.gs_kt != null ? `${a.gs_kt} kt` : '—'}</dd>
        </div>
        <div>
          <dt class="text-white/40">Hdg</dt>
          <dd>{a.heading != null ? `${a.heading}°` : '—'}</dd>
        </div>
      </dl>
      <a
        href={`/app/flights?hex=${a.hex}`}
        class="mt-3 inline-block text-xs text-sky-300 hover:underline"
      >
        Look up in my flights →
      </a>
    </aside>
  {/if}
</div>
