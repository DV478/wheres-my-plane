<script lang="ts">
  import '../app.css';

  let { data, children } = $props();
</script>

<header class="flex items-center justify-between px-6 py-4 border-b border-white/10">
  <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
    <span aria-hidden="true">✈️</span>
    <span>Where's My Plane</span>
  </a>
  <nav class="flex items-center gap-4 text-sm">
    {#if data.user}
      <a href="/app" class="hover:text-white">Dashboard</a>
      <a href="/app/settings" class="hover:text-white">Settings</a>
      <span class="text-white/50">{data.user.email}</span>
      <form method="POST" action="/logout">
        <button class="text-white/70 hover:text-white" type="submit">Sign out</button>
      </form>
    {:else}
      <a href="/login" class="hover:text-white">Sign in</a>
    {/if}
  </nav>
</header>

<main class="px-6 py-10 max-w-4xl mx-auto">
  {@render children()}
</main>
