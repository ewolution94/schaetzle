<script lang="ts">
  // The item's pictures: eBay's photos to swipe through (on a white plate, as shops show them), or a
  // demo item's emoji on a soft OTTO tint. `children` sits on top, e.g. the price tag at the reveal.
  import type { Snippet } from 'svelte';
  import type { Item } from '../lib/api';
  import { t } from '../lib/i18n.svelte';

  let { item, compact = false, children }: { item: Item; compact?: boolean; children?: Snippet } = $props();

  let track: HTMLDivElement | undefined = $state();
  let index = $state(0);

  function onScroll() {
    if (!track) return;
    index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  }

  function show(i: number) {
    track?.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  }
</script>

<div class="media" class:compact>
  {#if item.images.length}
    <div class="photos" bind:this={track} onscroll={onScroll}>
      {#each item.images as src, i (src)}
        <img {src} alt={item.images.length > 1 ? t('photo', { n: i + 1, total: item.images.length }) : ''} decoding="async" draggable="false" />
      {/each}
    </div>
    {#if item.images.length > 1}
      <div class="dots">
        {#each item.images as src, i (src)}
          <button class:on={i === index} aria-label={t('photo', { n: i + 1, total: item.images.length })} onclick={() => show(i)}></button>
        {/each}
      </div>
    {/if}
  {:else if item.art}
    <div class="art t-{item.art.tint}">
      <span class="emoji">{item.art.emoji}</span>
    </div>
  {/if}
  {#if children}
    <div class="over">{@render children()}</div>
  {/if}
</div>

<style>
  .media {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--card-radius);
    overflow: hidden;
    background: var(--plate);
    box-shadow: var(--ewo-shadow);
    /* The page scrolls vertically past it; only the photos scroll sideways. */
    contain: paint;
  }
  .media.compact {
    aspect-ratio: 4 / 3;
  }
  .photos {
    display: flex;
    height: 100%;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .photos::-webkit-scrollbar {
    display: none;
  }
  img {
    flex: none;
    width: 100%;
    height: 100%;
    object-fit: contain;
    scroll-snap-align: center;
    user-select: none;
    -webkit-user-drag: none;
  }
  .dots {
    position: absolute;
    left: 50%;
    bottom: 10px;
    translate: -50% 0;
    display: flex;
    gap: 2px;
    padding: 4px 6px;
    border-radius: var(--ewo-r-pill);
    background: rgb(33 33 33 / 0.55);
  }
  .dots button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
  }
  .dots button::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.5);
    transition: transform var(--ewo-dur-1);
  }
  .dots button.on::before {
    background: #ffffff;
    transform: scale(1.25);
  }

  .art {
    display: grid;
    place-items: center;
    height: 100%;
    background:
      radial-gradient(circle at 50% 42%, rgb(255 255 255 / calc(0.45 * var(--ewo-light))), transparent 60%),
      var(--tint);
  }
  .emoji {
    font-size: clamp(96px, 34vw, 190px);
    line-height: 1;
    filter: drop-shadow(0 18px 22px rgb(0 0 0 / 0.18));
  }
  .compact .emoji {
    font-size: clamp(72px, 24vw, 130px);
  }

  .over {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
