<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import FlightRow from '$lib/components/FlightRow.svelte';

  let { data } = $props();
</script>

<section class="space-y-6">
  <header class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Your flights</h1>
    <a
      href="/app/flights/new"
      class="rounded-md bg-sky-700 hover:bg-sky-600 px-4 py-2 text-sm font-medium"
    >
      + Add a flight
    </a>
  </header>

  {#if data.flights.length === 0}
    <EmptyState
      title="No upcoming flights yet."
      hint="Add one and the agent takes over."
      action={{ href: '/app/flights/new', label: 'Add a flight' }}
    />
  {:else}
    <ul class="divide-y divide-white/10 rounded-lg border border-white/10 bg-white/5">
      {#each data.flights as f (f.id)}
        <FlightRow flight={f} />
      {/each}
    </ul>
  {/if}
</section>
