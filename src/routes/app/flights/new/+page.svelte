<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
  let mode: 'natural' | 'form' = $state('natural');
  let submitting = $state(false);
</script>

<section class="max-w-xl space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold">Add a flight</h1>
    <p class="text-white/60 text-sm">
      Type naturally, or switch to the form if we can't understand.
    </p>
  </header>

  <div class="flex gap-2 text-sm">
    <button
      class="rounded-md px-3 py-1 {mode === 'natural'
        ? 'bg-white/15 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'}"
      onclick={() => (mode = 'natural')}
    >
      Natural
    </button>
    <button
      class="rounded-md px-3 py-1 {mode === 'form'
        ? 'bg-white/15 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'}"
      onclick={() => (mode = 'form')}
    >
      Form
    </button>
  </div>

  <form
    method="POST"
    class="space-y-4"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    {#if mode === 'natural'}
      <label class="block">
        <span class="block text-sm text-white/70 mb-1">What flight?</span>
        <input
          name="text"
          type="text"
          placeholder="BA456 tomorrow"
          value={form?.text ?? ''}
          autocomplete="off"
          class="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 focus:outline-none focus:border-sky-500"
        />
      </label>
    {:else}
      <label class="block">
        <span class="block text-sm text-white/70 mb-1">Flight number</span>
        <input
          name="flight_no"
          type="text"
          placeholder="BA456"
          value={form?.flight_no ?? ''}
          autocomplete="off"
          class="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 uppercase focus:outline-none focus:border-sky-500"
        />
      </label>
      <label class="block">
        <span class="block text-sm text-white/70 mb-1">Date</span>
        <input
          name="flight_date"
          type="date"
          value={form?.flight_date ?? ''}
          class="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 focus:outline-none focus:border-sky-500"
        />
      </label>
      <label class="block">
        <span class="block text-sm text-white/70 mb-1">
          What did you pay <span class="text-white/40">(optional, GBP)</span>
        </span>
        <input
          name="paid_price_gbp"
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g. 420.00"
          class="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 focus:outline-none focus:border-sky-500"
        />
      </label>
    {/if}

    {#if form?.error}
      <p class="text-sm text-red-400">{form.error}</p>
    {/if}

    <button
      type="submit"
      disabled={submitting}
      class="w-full rounded-md bg-sky-700 hover:bg-sky-600 disabled:opacity-50 px-4 py-2 font-medium"
    >
      {submitting ? 'Finding your aircraft…' : 'Add flight'}
    </button>
  </form>
</section>
