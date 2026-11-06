<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';

  let { data, form } = $props();

  let browserTz = $state('UTC');
  let selectedTz = $state<string>('');
  let codeExpiresIn = $state<number | null>(null);
  let now = $state(Date.now());

  onMount(() => {
    try {
      browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
      browserTz = 'UTC';
    }
    selectedTz = data.homeTz ?? browserTz;

    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(tick);
  });

  const activeCode = $derived(form?.code ? form : data.activeCode);

  $effect(() => {
    const exp = (form?.expiresAt as number | undefined) ?? data.activeCode?.expiresAt ?? null;
    if (exp == null) {
      codeExpiresIn = null;
      return;
    }
    const remaining = exp - Math.floor(now / 1000);
    codeExpiresIn = remaining > 0 ? remaining : 0;
  });

  function mmss(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<section class="space-y-8">
  <header>
    <h1 class="text-2xl font-semibold">Settings</h1>
    <p class="text-sm text-white/60 mt-1">Link Telegram and set your home timezone.</p>
  </header>

  <div class="rounded-lg border border-white/10 bg-white/5 p-5 space-y-4">
    <h2 class="text-lg font-medium">Telegram alerts</h2>

    {#if data.tgLinked}
      <p class="text-sm text-green-300">
        Linked to chat <code class="font-mono">{data.tgChatId}</code>.
      </p>
      <form method="POST" action="?/unlinkTelegram" use:enhance>
        <button
          type="submit"
          class="rounded-md border border-red-400/40 text-red-200 hover:bg-red-500/10 px-3 py-1.5 text-sm"
        >
          Unlink
        </button>
      </form>
    {:else}
      <p class="text-sm text-white/70">
        To link: open the bot in Telegram, run <code class="font-mono">/start</code>, then reply with
        <code class="font-mono">/link &lt;code&gt;</code>.
      </p>

      {#if activeCode && codeExpiresIn !== null && codeExpiresIn > 0}
        <div class="rounded-md border border-sky-400/40 bg-sky-500/10 p-4">
          <div class="text-xs text-sky-200 uppercase tracking-wide">Your link code</div>
          <div class="font-mono text-3xl tracking-widest mt-1">{activeCode.code}</div>
          <div class="text-xs text-sky-200 mt-2">
            Expires in {mmss(codeExpiresIn)}
          </div>
        </div>
      {/if}

      <form method="POST" action="?/generateCode" use:enhance>
        <button
          type="submit"
          class="rounded-md bg-sky-700 hover:bg-sky-600 px-3 py-1.5 text-sm font-medium"
        >
          {activeCode && codeExpiresIn && codeExpiresIn > 0 ? 'Regenerate code' : 'Generate code'}
        </button>
      </form>
    {/if}
  </div>

  <div class="rounded-lg border border-white/10 bg-white/5 p-5 space-y-4">
    <h2 class="text-lg font-medium">Home timezone</h2>
    <p class="text-sm text-white/70">
      Used to interpret "tomorrow" when you add a flight by text.
      Browser reports <code class="font-mono">{browserTz}</code>.
    </p>

    <form method="POST" action="?/setTimezone" use:enhance class="flex gap-2 items-center">
      <input
        name="home_tz"
        bind:value={selectedTz}
        class="rounded-md bg-black/40 border border-white/10 px-3 py-1.5 text-sm font-mono"
        placeholder="Europe/London"
      />
      <button
        type="submit"
        class="rounded-md bg-sky-700 hover:bg-sky-600 px-3 py-1.5 text-sm font-medium"
      >
        Save
      </button>
      {#if selectedTz !== browserTz}
        <button
          type="button"
          onclick={() => (selectedTz = browserTz)}
          class="text-xs text-white/60 hover:text-white underline"
        >
          Use browser ({browserTz})
        </button>
      {/if}
    </form>

    {#if form?.ok && form?.home_tz}
      <p class="text-xs text-green-300">Saved {form.home_tz}.</p>
    {:else if form?.error === 'bad_tz'}
      <p class="text-xs text-red-300">That's not a recognised IANA timezone.</p>
    {/if}
  </div>
</section>
