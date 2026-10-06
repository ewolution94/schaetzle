<script lang="ts">
  import { onMount } from 'svelte';
  import type { Player, View } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import { formatPoints, formatPrice } from '../lib/price';
  import Avatar from './Avatar.svelte';

  let { view, me, isHost, act }: { view: View; me: Player; isHost: boolean; act: (action: string, body?: unknown) => Promise<boolean> } = $props();

  const ranked = $derived([...view.players].sort((a, b) => b.score - a.score));
  /** Ranks with ties: 1000, 900, 900, 400 → 1, 2, 2, 4. */
  const ranks = $derived(ranked.map((p, i) => ranked.findIndex((q) => q.score === p.score) + 1));
  const podium = $derived(ranked.slice(0, 3));
  const tie = $derived(ranked.length > 1 && ranked[0].score === ranked[1].score);
  const byId = $derived(new Map(view.players.map((p) => [p.id, p])));
  const host = $derived(view.players.find((p) => p.id === view.host));

  // A few pieces of confetti in OTTO's colours, once. Nothing keeps moving afterwards.
  const CONFETTI = ['#dc001d', '#64c8b9', '#f5d547', '#b198db', '#6ea0eb', '#f8a171'];
  let pieces: { x: number; d: number; r: number; c: string; s: number }[] = $state([]);
  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    pieces = Array.from({ length: 36 }, (_, i) => ({
      x: Math.random() * 100,
      d: Math.random() * 0.6,
      r: Math.random() * 720 - 360,
      c: CONFETTI[i % CONFETTI.length],
      s: 6 + Math.random() * 6,
    }));
    const timer = setTimeout(() => (pieces = []), 3200);
    return () => clearTimeout(timer);
  });
</script>

<section class="final">
  <div class="confetti" aria-hidden="true">
    {#each pieces as p, i (i)}
      <span style:left="{p.x}%" style:--d="{p.d}s" style:--r="{p.r}deg" style:background={p.c} style:--s="{p.s}px"></span>
    {/each}
  </div>

  <header>
    <p class="label">{t('results')}</p>
    <h1>{tie ? t('tie') : t('winner', { name: ranked[0]?.name ?? '' })}</h1>
  </header>

  <ol class="podium">
    {#each podium as player, i (player.id)}
      <li class="place p{ranks[i]}" style:--i={i}>
        <Avatar {player} size={i === 0 ? 64 : 48} />
        <span class="name">{player.name}</span>
        <span class="score price">{formatPoints(player.score)}</span>
        <span class="step"><span class="rank price">{ranks[i]}</span></span>
      </li>
    {/each}
  </ol>

  {#if ranked.length > 3}
    <ol class="rest card">
      {#each ranked.slice(3) as player, i (player.id)}
        <li class:me={player.id === me.id}>
          <span class="rank">{ranks[i + 3]}.</span>
          <Avatar {player} size={30} />
          <span class="name">{player.name}</span>
          <span class="score price">{formatPoints(player.score)}</span>
        </li>
      {/each}
    </ol>
  {/if}

  <div class="actions">
    {#if isHost}
      <button class="btn primary block" onclick={() => act('rematch')}>{t('rematch')}</button>
    {:else}
      <p class="waiting">{t('waitingFor', { name: host?.name ?? '…' })}</p>
    {/if}
  </div>

  <div class="recap">
    <p class="label">{t('recap')}</p>
    <ol>
      {#each view.history as round (round.n)}
        {@const best = round.best ? byId.get(round.best.player) : null}
        <li>
          <span class="thumb">
            {#if round.image}
              <img src={round.image} alt="" loading="lazy" />
            {:else if round.art}
              <span class="t-{round.art.tint}">{round.art.emoji}</span>
            {/if}
          </span>
          <span class="what">
            {#if round.url}
              <a href={round.url} target="_blank" rel="noopener noreferrer">{round.title}</a>
            {:else}
              {round.title}
            {/if}
            {#if best && round.best}
              <span class="best">{t('closest')}: {best.name} · {formatPrice(round.best.guess)}</span>
            {/if}
          </span>
          <span class="was price">{formatPrice(round.price)}</span>
        </li>
      {/each}
    </ol>
  </div>
</section>

<style>
  .final {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 640px;
    margin: 0 auto;
  }
  header {
    text-align: center;
  }
  header .label {
    margin: 0 0 6px;
  }
  h1 {
    margin: 0;
    font: 800 clamp(28px, 7vw, 40px) / 1.1 var(--ewo-sans);
    letter-spacing: -0.03em;
  }

  .podium {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: end;
    gap: 10px;
  }
  .place {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    animation: up 0.6s var(--ewo-ease) both;
    animation-delay: calc(0.15s + (2 - var(--i)) * 0.15s);
  }
  /* First in the middle, second left, third right. */
  .place:nth-child(1) {
    order: 2;
  }
  .place:nth-child(2) {
    order: 1;
  }
  .place:nth-child(3) {
    order: 3;
  }
  @keyframes up {
    from {
      opacity: 0;
      translate: 0 20px;
    }
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 650;
  }
  .score {
    font-size: 18px;
  }
  .step {
    display: grid;
    place-items: start center;
    width: 100%;
    padding-top: 10px;
    border-radius: 12px 12px 0 0;
    background: var(--ewo-fill-2);
    height: 64px;
  }
  .place:nth-child(1) .step {
    height: 108px;
    background: var(--red);
    color: #ffffff;
  }
  .place:nth-child(2) .step {
    height: 80px;
  }
  .rank {
    font-size: 24px;
  }

  .rest {
    list-style: none;
    margin: 0;
    padding: 6px 16px;
  }
  .rest li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
  }
  .rest li + li {
    border-top: 1px solid var(--ewo-line-2);
  }
  .rest .rank {
    width: 2ch;
    font-size: 14px;
    color: var(--ewo-fg-3);
  }
  .rest .name {
    flex: 1;
    min-width: 0;
  }
  .rest .me .name {
    color: var(--red-text);
  }

  .waiting {
    margin: 0;
    padding: 14px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--ewo-line-2);
    text-align: center;
    color: var(--ewo-fg-2);
  }

  .recap .label {
    margin: 0 0 8px;
  }
  .recap ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .recap li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--ewo-line-2);
  }
  .thumb {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--plate);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .thumb span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    background: var(--tint);
    font-size: 26px;
  }
  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
    line-height: 1.35;
  }
  .what a {
    text-decoration: none;
  }
  .what a:hover {
    text-decoration: underline;
  }
  .best {
    color: var(--ewo-fg-3);
    font-size: 12px;
  }
  .was {
    font-size: 16px;
    color: var(--red-text);
  }

  .confetti {
    position: fixed;
    inset: 0;
    z-index: 30;
    pointer-events: none;
    overflow: hidden;
  }
  .confetti span {
    position: absolute;
    top: -16px;
    width: var(--s);
    height: calc(var(--s) * 0.45);
    border-radius: 2px;
    animation: fall 2.6s cubic-bezier(0.3, 0.6, 0.5, 1) var(--d) both;
  }
  @keyframes fall {
    to {
      translate: 0 105dvh;
      rotate: var(--r);
      opacity: 0.6;
    }
  }
</style>
