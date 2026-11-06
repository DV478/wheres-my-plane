<script lang="ts">
  import { DateTime } from 'luxon';

  interface Flight {
    id: string;
    flight_no: string;
    flight_date: string;
    origin_iata: string | null;
    dest_iata: string | null;
    sched_dep_utc: number | null;
    status: string;
    assigned_reg: string | null;
    aircraft_type: string | null;
  }
  let { flight }: { flight: Flight } = $props();

  const whenLine = $derived.by(() => {
    if (flight.sched_dep_utc) {
      return DateTime.fromSeconds(flight.sched_dep_utc, { zone: 'utc' })
        .toLocal()
        .toFormat('ccc d LLL · HH:mm');
    }
    return flight.flight_date;
  });

  const statusColor = $derived.by(() => {
    switch (flight.status) {
      case 'airborne':
        return 'text-sky-400';
      case 'landed':
        return 'text-emerald-400';
      case 'cancelled':
        return 'text-red-400';
      case 'diverted':
        return 'text-amber-400';
      default:
        return 'text-white/50';
    }
  });
</script>

<li>
  <a
    href={`/app/flights/${flight.id}`}
    class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/5"
  >
    <div class="min-w-0">
      <p class="font-medium truncate">
        {flight.flight_no}
        <span class="text-white/40 font-normal">
          {flight.origin_iata ?? '—'} → {flight.dest_iata ?? '—'}
        </span>
      </p>
      <p class="text-xs text-white/50 mt-0.5">
        {whenLine}
        {#if flight.assigned_reg}
          <span class="text-white/40"> · {flight.assigned_reg}</span>
        {/if}
        {#if flight.aircraft_type}
          <span class="text-white/40"> · {flight.aircraft_type}</span>
        {/if}
      </p>
    </div>
    <span class="text-xs capitalize {statusColor}">{flight.status}</span>
  </a>
</li>
