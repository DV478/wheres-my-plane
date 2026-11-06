<script lang="ts">
  import type { OtpLine } from '$lib/server/flights/otp';
  let { line }: { line: OtpLine } = $props();

  const sourceClass = $derived.by(() => {
    switch (line.source) {
      case 'EUROCONTROL':
      case 'BTS':
      case 'CAA':
        return 'bg-emerald-900/40 border-emerald-600/40 text-emerald-200';
      case 'provider':
        return 'bg-sky-900/40 border-sky-600/40 text-sky-200';
      case 'pending':
        return 'bg-white/5 border-white/10 text-white/60';
      default:
        return 'bg-white/5 border-white/10 text-white/60';
    }
  });
</script>

<div class="rounded-lg border px-4 py-3 text-sm {sourceClass}">
  <div class="flex items-center gap-2">
    <span class="font-medium">{line.source}</span>
    {#if line.otp15 !== null}
      <span class="text-white/70">·</span>
      <span>{line.otp15.toFixed(0)}% on time (≤15 min)</span>
    {/if}
  </div>
  <p class="text-xs text-white/60 mt-1">{line.label}</p>
</div>
