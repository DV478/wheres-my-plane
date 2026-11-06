<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
  let submitting = $state(false);
</script>

<section class="max-w-md mx-auto space-y-6">
  <h1 class="text-2xl font-semibold">Sign in</h1>
  <p class="text-sm text-white/60">Enter your email. We'll send a one-time link.</p>

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
    <label class="block">
      <span class="block text-sm text-white/70 mb-1">Email</span>
      <input
        name="email"
        type="email"
        required
        autocomplete="email"
        value={form?.email ?? ''}
        class="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 focus:outline-none focus:border-sky-500"
      />
    </label>

    {#if form?.error}
      <p class="text-sm text-red-400">{form.error}</p>
    {/if}

    <button
      type="submit"
      disabled={submitting}
      class="w-full rounded-md bg-sky-700 hover:bg-sky-600 disabled:opacity-50 px-4 py-2 font-medium"
    >
      {submitting ? 'Sending…' : 'Send sign-in link'}
    </button>
  </form>

  <p class="text-xs text-white/40">Invite-only while in build.</p>
</section>
