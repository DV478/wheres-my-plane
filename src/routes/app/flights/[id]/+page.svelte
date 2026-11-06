<script lang="ts">
  import AircraftCard from '$lib/components/AircraftCard.svelte';
  import OtpBadge from '$lib/components/OtpBadge.svelte';
  import { renderDual, renderDate } from '$lib/time';

  let { data } = $props();

  const dep = $derived(
    data.flight.sched_dep_utc && data.origin?.tz
      ? renderDual(data.flight.sched_dep_utc, data.origin.tz, data.homeTz)
      : null
  );
  const arr = $derived(
    data.flight.sched_arr_utc && data.dest?.tz
      ? renderDual(data.flight.sched_arr_utc, data.dest.tz, data.homeTz)
      : null
  );
  const depDate = $derived(
    data.flight.sched_dep_utc && data.origin?.tz
      ? renderDate(data.flight.sched_dep_utc, data.origin.tz)
      : data.flight.flight_date
  );
</script>

<section class="space-y-6">
  <nav class="text-sm">
    <a href="/app/flights" class="text-white/60 hover:text-white">← Your flights</a>
  </nav>

  <header class="space-y-2">
    <h1 class="text-3xl font-semibold tracking-tight">{data.flight.flight_no}</h1>
    <p class="text-white/70">
      {data.origin?.name ?? data.flight.origin_iata ?? '—'}
      <span class="text-white/40">→</span>
      {data.dest?.name ?? data.flight.dest_iata ?? '—'}
    </p>
    <p class="text-sm text-white/50">{depDate}</p>
  </header>

  <dl class="grid gap-4 sm:grid-cols-2 text-sm">
    {#if dep}
      <div class="rounded-lg border border-white/10 p-4">
        <dt class="text-white/50 mb-1">Scheduled departure</dt>
        <dd class="font-medium">{dep}</dd>
      </div>
    {/if}
    {#if arr}
      <div class="rounded-lg border border-white/10 p-4">
        <dt class="text-white/50 mb-1">Scheduled arrival</dt>
        <dd class="font-medium">{arr}</dd>
      </div>
    {/if}
    <div class="rounded-lg border border-white/10 p-4">
      <dt class="text-white/50 mb-1">Status</dt>
      <dd class="font-medium capitalize">{data.flight.status}</dd>
    </div>
    {#if data.flight.paid_price_gbp}
      <div class="rounded-lg border border-white/10 p-4">
        <dt class="text-white/50 mb-1">You paid</dt>
        <dd class="font-medium">
          {new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP'
          }).format(data.flight.paid_price_gbp)}
        </dd>
      </div>
    {/if}
  </dl>

  <OtpBadge line={data.otp} />

  {#if data.aircraft}
    <AircraftCard aircraft={data.aircraft} />
  {:else}
    <div class="rounded-lg border border-white/10 p-5 bg-white/5">
      <h2 class="font-medium mb-1">Aircraft not yet assigned</h2>
      <p class="text-sm text-white/60">
        Airlines often publish the tail number only on the day of travel. We'll show it here when it's known.
      </p>
    </div>
  {/if}
</section>
