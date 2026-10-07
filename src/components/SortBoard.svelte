<script lang="ts">
  // Four items to put in order. In a round each tap gives the next place (cheapest first) and a
  // second tap takes it back; at the reveal the items stand in their real order with their prices,
  // and your own places are marked right or wrong.
  import type { Item } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import { formatPrice } from '../lib/price';
  import Thumb from './Thumb.svelte';

  let {
    items,
    order = [],
    onpick,
    disabled = false,
    prices = null,
    mine = null,
    big = false,
  }: {
    items: Item[];
    /** ids, cheapest first, as placed so far */
    order?: string[];
    onpick?: (id: string) => void;
    disabled?: boolean;
    /** At the reveal: each item's price (the items come in their real order). */
    prices?: Map<string, number> | null;
    /** At the reveal: your order, to mark your places. */
    mine?: string[] | null;
    big?: boolean;
  } = $props();
</script>

<ol class="board" class:big class:reveal={prices !== null}>
  {#each items as item, i (item.id)}
    {@const place = order.indexOf(item.id)}
    {@const yours = mine ? mine.indexOf(item.id) : -1}
    <li style:--i={i}>
      {#if onpick}
        <button
          class="card item"
          class:placed={place > -1}
          aria-pressed={place > -1}
          aria-label="{item.title ?? t('noTitle')}{place > -1 ? `, ${t('placed', { n: place + 1 })}` : ''}"
          {disabled}
          onclick={() => onpick(item.id)}
        >
          <span class="pic"><Thumb image={item.images[0] ?? null} art={item.art} /></span>
          {#if place > -1}<span class="rank price" aria-hidden="true">{place + 1}</span>{/if}
          {#if item.title}<span class="title">{item.title}</span>{/if}
        </button>
      {:else}
        <div class="card item">
          <span class="pic"><Thumb image={item.images[0] ?? null} art={item.art} /></span>
          {#if prices}
            <span class="rank price truth" aria-label={t('placed', { n: i + 1 })}>{i + 1}</span>
            <span class="tag price">{formatPrice(prices.get(item.id) ?? 0)}</span>
          {/if}
          {#if item.title}<span class="title">{item.title}</span>{/if}
          {#if yours > -1}
            <span class="yours" class:ok={yours === i}>{t('yourOrder')}: {yours + 1}</span>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .board {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  @media (min-width: 820px) {
    .board {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
  }
  .board.big {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(12px, 1.6vw, 28px);
  }
  li {
    min-width: 0;
  }
  .reveal li {
    animation: rise 0.45s var(--ewo-ease) both;
    animation-delay: calc(0.1s + var(--i) * 0.12s);
  }
  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 10px;
    }
  }
  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    overflow: hidden;
    text-align: left;
    -webkit-tap-highlight-color: transparent;
    transition:
      box-shadow var(--ewo-dur-1) var(--ewo-ease),
      transform var(--ewo-dur-1) var(--ewo-ease);
  }
  button.item:active:not(:disabled) {
    transform: scale(0.98);
  }
  button.item:focus-visible {
    outline: 2px solid var(--red-text);
    outline-offset: 2px;
  }
  .item.placed {
    box-shadow:
      0 0 0 2px var(--red),
      var(--ewo-shadow);
  }
  button.item:disabled {
    cursor: default;
  }
  .pic {
    display: block;
    aspect-ratio: 1;
  }
  .rank {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--red);
    color: #ffffff;
    font-size: 18px;
    box-shadow: 0 4px 10px rgb(150 0 20 / 0.3);
    animation: pop 0.3s var(--ewo-ease-spring) both;
  }
  .rank.truth {
    background: var(--otto-ink);
    box-shadow: none;
  }
  @keyframes pop {
    from {
      scale: 0.4;
      opacity: 0;
    }
  }
  /* At the reveal the price sits under the photo, in the reveal's red. */
  .tag {
    margin: 10px 12px 0;
    color: var(--red-text);
    font-size: 20px;
    line-height: 1.1;
  }
  .big .tag {
    font-size: clamp(20px, 2vw, 36px);
  }
  .tag + .title {
    margin-top: 4px;
  }
  .title {
    display: -webkit-box;
    margin: 10px 12px 12px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font: 600 13px/1.35 var(--ewo-sans);
    overflow-wrap: anywhere;
  }
  .big .title {
    font-size: clamp(14px, 1.1vw, 20px);
  }
  .yours {
    margin: auto 12px 12px;
    color: var(--red-text);
    font: 600 12px/1.3 var(--ewo-sans);
  }
  .yours.ok {
    color: var(--ewo-fg-3);
  }
  .yours.ok::after {
    content: ' ✓';
  }
</style>
