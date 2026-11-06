<script lang="ts">
  let { data } = $props();
</script>

<section class="space-y-6">
  <h1 class="text-4xl font-bold tracking-tight">Know where your plane is, before you ask.</h1>
  <p class="text-lg text-white/70 leading-relaxed">
    A personal flight companion with an always-on agent. Tell it a flight you've booked.
    It finds the aircraft, tracks where it flies before you board, watches for disruption,
    and tells you by voice when something changes.
  </p>

  <ul class="grid gap-3 sm:grid-cols-2 text-sm">
    <li class="rounded-lg border border-white/10 p-4">
      <strong class="block mb-1">Meet your aircraft</strong>
      <span class="text-white/60">Registration, age, previous operators, and today's route.</span>
    </li>
    <li class="rounded-lg border border-white/10 p-4">
      <strong class="block mb-1">Travel-day alerts</strong>
      <span class="text-white/60">Quiet until something changes. Then a text + voice note to Telegram.</span>
    </li>
    <li class="rounded-lg border border-white/10 p-4">
      <strong class="block mb-1">Ask by voice</strong>
      <span class="text-white/60">"Where's my plane?" — live answer, local times, no fluff.</span>
    </li>
    <li class="rounded-lg border border-white/10 p-4">
      <strong class="block mb-1">Photo spotter</strong>
      <span class="text-white/60">Upload a photo of any aircraft, get its story.</span>
    </li>
  </ul>

  <div class="pt-4">
    {#if data.user}
      <a href="/app" class="inline-block rounded-lg bg-sky-700 hover:bg-sky-600 px-5 py-3 font-medium">
        Open dashboard
      </a>
    {:else}
      <a href="/login" class="inline-block rounded-lg bg-sky-700 hover:bg-sky-600 px-5 py-3 font-medium">
        Sign in
      </a>
      <p class="mt-2 text-xs text-white/40">Invite-only while in build.</p>
    {/if}
  </div>
</section>
