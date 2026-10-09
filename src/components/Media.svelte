<script lang="ts">
  // The item's pictures: eBay's photos to swipe through, or a demo item's emoji on a soft OTTO tint.
  // A photo is shown whole, and the same photo, zoomed and blurred, fills the frame around it (the
  // user, 2026-10-09: no white bands beside a tall or wide picture). `children` sits on top, e.g. the
  // price tag at the reveal.
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
        <div class="slide">
          <img class="fill" {src} alt="" aria-hidden="true" decoding="async" draggable="false" />
          <img class="photo" {src} alt={item.images.length > 1 ? t('photo', { n: i + 1, total: item.images.length }) : ''} decoding="async" draggable="false" />
        </div>
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
  .slide {
    position: relative;
    flex: none;
    width: 100%;
    height: 100%;
    overflow: hidden;
    scroll-snap-align: center;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    user-select: none;
    -webkit-user-drag: none;
  }
  /* The backdrop: the photo itself, filling the frame, soft and a little larger so its blurred edges
     stay outside. Still, never animated (learnings/performance.md). */
  .fill {
    object-fit: cover;
    filter: blur(22px) saturate(1.2);
    scale: 1.25;
  }
  /* The photo, whole, lifted off its backdrop. */
  .photo {
    object-fit: contain;
    filter: drop-shadow(0 8px 20px rgb(0 0 0 / 0.22));
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
