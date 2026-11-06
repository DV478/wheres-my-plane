<script lang="ts">
  import type { AircraftCardData } from '$lib/server/aircraft';
  let { aircraft }: { aircraft: AircraftCardData } = $props();
</script>

<section class="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
  {#if aircraft.photo}
    <figure class="relative">
      <img
        src={aircraft.photo.url}
        alt="{aircraft.reg ?? aircraft.hex} aircraft photo"
        loading="lazy"
        class="w-full h-56 object-cover"
      />
      <figcaption
        class="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5 text-xs text-white/80"
      >
        Photo © <a
          href={aircraft.photo.link}
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-white">{aircraft.photo.photographer}</a
        > · Planespotters
      </figcaption>
    </figure>
  {/if}

  <div class="p-5 space-y-4">
    <header class="space-y-1">
      <h2 class="text-xl font-semibold">
        {aircraft.reg ?? aircraft.hex ?? 'Unknown aircraft'}
      </h2>
      {#if aircraft.type_name || aircraft.type_icao}
        <p class="text-white/70 text-sm">
          {aircraft.type_name ?? aircraft.type_icao}
        </p>
      {/if}
    </header>

    <dl class="grid grid-cols-2 gap-3 text-sm">
      {#if aircraft.operator}
        <div>
          <dt class="text-white/50">Operator</dt>
          <dd>{aircraft.operator}</dd>
        </div>
      {/if}
      {#if aircraft.build_year !== null}
        <div>
          <dt class="text-white/50">Built</dt>
          <dd>
            {aircraft.build_year}
            {#if aircraft.age_years !== null}
              <span class="text-white/40">· {aircraft.age_years}y old</span>
            {/if}
          </dd>
        </div>
      {/if}
      {#if aircraft.delivery_date}
        <div>
          <dt class="text-white/50">Delivered</dt>
          <dd>{aircraft.delivery_date}</dd>
        </div>
      {/if}
      {#if aircraft.first_flight_date}
        <div>
          <dt class="text-white/50">First flight</dt>
          <dd>{aircraft.first_flight_date}</dd>
        </div>
      {/if}
    </dl>

    {#if aircraft.prev_regs && aircraft.prev_regs.length > 0}
      <div>
        <p class="text-xs uppercase tracking-wide text-white/50 mb-2">Previous registrations</p>
        <ul class="flex flex-wrap gap-2 text-xs">
          {#each aircraft.prev_regs as r}
            <li class="rounded-md bg-white/10 px-2 py-1">
              {r.reg}
              {#if r.from || r.to}
                <span class="text-white/50"> ({r.from ?? '?'}–{r.to ?? 'now'})</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</section>
