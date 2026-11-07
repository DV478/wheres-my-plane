<script lang="ts">
  let { data } = $props();

  let active = $state(false);
  let tickCount = $state(0);
  let lastTickAt = $state<number | null>(null);
  let lastError = $state<string | null>(null);
  let tabHidden = $state(false);
  let now = $state(Date.now());

  const statusLine = $derived(
    !active
      ? 'Idle'
      : tabHidden
        ? 'Paused — tab hidden'
        : lastTickAt === null
          ? 'Starting…'
          : `Active — last tick ${Math.round((now - lastTickAt) / 1000)}s ago`
  );

  async function kick() {
    if (tabHidden) return;
    try {
      const res = await fetch('/api/scheduler/kick', { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        lastError =
          res.status === 401
            ? 'Session expired — reload to sign in again'
            : `Error ${res.status}: ${text.slice(0, 120)}`;
        return;
      }
      lastError = null;
      tickCount += 1;
      lastTickAt = Date.now();
    } catch (err) {
      // Keep the interval alive — transient errors don't stop ticking.
      lastError = `Network error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  $effect(() => {
    if (!active) return;

    void kick();
    const tickInterval = setInterval(() => void kick(), 120_000);
    const clockInterval = setInterval(() => { now = Date.now(); }, 1000);

    function onVisibilityChange() {
      tabHidden = document.visibilityState === 'hidden';
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(tickInterval);
      clearInterval(clockInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });

  function toggle() {
    if (active) {
      active = false;
      tickCount = 0;
      lastTickAt = null;
      lastError = null;
      tabHidden = false;
    } else {
      active = true;
    }
  }
</script>

<section class="space-y-6">
  <h1 class="text-2xl font-semibold">Hello, {data.user.email}.</h1>

  <div class="rounded-lg border border-white/10 p-5 bg-white/5 space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="font-medium">Scheduler</h2>
      <button
        class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors {active
          ? 'bg-red-700 hover:bg-red-600'
          : 'bg-green-700 hover:bg-green-600'}"
        onclick={toggle}
      >
        {active ? 'Stop' : 'Start'}
      </button>
    </div>
    <div class="text-sm text-white/70 space-y-1">
      <p>{statusLine}</p>
      {#if tickCount > 0}
        <p class="text-white/40 text-xs">Ticks this session: {tickCount}</p>
      {/if}
      {#if lastError}
        <p class="text-amber-300 text-xs">{lastError}</p>
      {/if}
    </div>
  </div>

  <div class="flex flex-wrap gap-3">
    <a
      href="/app/flights"
      class="rounded-md bg-sky-700 hover:bg-sky-600 px-4 py-2 text-sm font-medium"
      >Your flights</a
    >
    <a
      href="/app/map"
      class="rounded-md bg-indigo-700 hover:bg-indigo-600 px-4 py-2 text-sm font-medium"
      >Live map</a
    >
  </div>

  <div class="rounded-lg border border-white/10 p-5 bg-white/5">
    <h2 class="font-medium mb-2">What's next</h2>
    <ul class="text-sm text-white/70 space-y-1 list-disc pl-5">
      <li>Phase 3 — Scheduled agent + Telegram alerts</li>
      <li>Phase 4 — Voice Q&amp;A</li>
      <li>Phase 5 — Photo spotter</li>
      <li>Phase 6 — Price monitoring</li>
      <li>Phase 7 — PWA, push, offline</li>
    </ul>
  </div>
</section>
