<script lang="ts">
  interface Props {
    title: string;
    hint?: string;
    action?: { href: string; label: string };
  }
  let { title, hint, action }: Props = $props();
</script>

<div class="rounded-lg border border-dashed border-white/15 p-10 text-center space-y-3">
  <p class="font-medium">{title}</p>
  {#if hint}
    <p class="text-sm text-white/60">{hint}</p>
  {/if}
  {#if action}
    <a
      href={action.href}
      class="inline-block rounded-md bg-sky-700 hover:bg-sky-600 px-4 py-2 text-sm font-medium"
    >
      {action.label}
    </a>
  {/if}
</div>
