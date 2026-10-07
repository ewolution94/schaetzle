<script lang="ts">
  // Higher or lower: the item to beat, with its price. At the reveal an arrow says which way the
  // new price went.
  import type { Item } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import { formatPrice } from '../lib/price';
  import Thumb from './Thumb.svelte';

  let { anchor, then = null, big = false }: { anchor: Item & { price: number }; then?: number | null; big?: boolean } = $props();

  const way = $derived(then === null ? null : then > anchor.price ? 'higher' : then < anchor.price ? 'lower' : 'same');
</script>

<div class="anchor card" class:big>
  <span class="pic"><Thumb image={anchor.images[0] ?? null} art={anchor.art} /></span>
  <span class="text">
    <span class="label">{t('toCompare')}</span>
    {#if anchor.title}<span class="title">{anchor.title}</span>{/if}
  </span>
  <span class="price was">{formatPrice(anchor.price)}</span>
  {#if way}
    <span class="way {way}" aria-label={way === 'same' ? '=' : t(`pick_${way}`)}>
      {#if way === 'same'}={:else}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>{/if}
    </span>
  {/if}
</div>

<style>
  .anchor {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px 8px 8px;
  }
  .pic {
    flex: none;
    width: 56px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
  }
  .big .pic {
    width: clamp(64px, 6vw, 110px);
    height: clamp(64px, 6vw, 110px);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    margin: 0;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 500 14px/1.35 var(--ewo-sans);
    color: var(--ewo-fg-2);
  }
  .big .title {
    font-size: clamp(14px, 1.2vw, 22px);
  }
  .was {
    flex: none;
    font-size: 22px;
  }
  .big .was {
    font-size: clamp(22px, 2.4vw, 44px);
  }
  .way {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--red);
    color: #ffffff;
    font: 800 16px/1 var(--ewo-sans);
    animation: pop 0.4s var(--ewo-ease-spring) 0.3s both;
  }
  .way.lower svg {
    rotate: 180deg;
  }
  .way svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }
</style>
