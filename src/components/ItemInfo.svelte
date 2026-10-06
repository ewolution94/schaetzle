<script lang="ts">
  import type { Item } from '../lib/api';
  import { t, type Key } from '../lib/i18n.svelte';

  let { item }: { item: Item } = $props();
</script>

<div class="info">
  <div class="chips">
    {#if item.condition}<span class="chip">{item.condition}</span>{/if}
    <span class="chip">{t(`theme_${item.theme}` as Key)}</span>
  </div>
  {#if item.title}
    <h2>{item.title}</h2>
  {:else}
    <h2 class="hidden">{t('noTitle')}</h2>
  {/if}
</div>

<style>
  .info {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 5px 10px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-2);
    color: var(--ewo-fg-2);
    font: 500 13px/1.2 var(--ewo-sans);
  }
  h2 {
    margin: 0;
    font: 650 clamp(18px, 4.6vw, 22px) / 1.35 var(--ewo-sans);
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }
  .hidden {
    color: var(--ewo-fg-3);
    font-style: italic;
    font-weight: 500;
  }
</style>
