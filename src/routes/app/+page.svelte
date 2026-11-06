<script lang="ts">
  let { data } = $props();
</script>

<section class="space-y-6">
  <h1 class="text-2xl font-semibold">Hello, {data.user.email}.</h1>

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
