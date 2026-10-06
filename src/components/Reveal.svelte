<script lang="ts">
  import { onMount } from 'svelte';
  import type { Player, View } from '../lib/api';
  import { i18n, t } from '../lib/i18n.svelte';
  import { formatDeviation, formatPoints, formatPrice } from '../lib/price';
  import { ripple } from '../lib/field';
  import Media from './Media.svelte';
  import ItemInfo from './ItemInfo.svelte';
  import PriceTag from './PriceTag.svelte';
  import PriceLine from './PriceLine.svelte';
  import Avatar from './Avatar.svelte';

  let { view, me, isHost, act }: { view: View; me: Player; isHost: boolean; act: (action: string, body?: unknown) => Promise<boolean> } = $props();

  const round = $derived(view.round!);
  const reveal = $derived(view.reveal!);
  const last = $derived(round.n >= round.total);
  const host = $derived(view.players.find((p) => p.id === view.host));
  const byId = $derived(new Map(view.players.map((p) => [p.id, p])));
  /** The closest real guess gets the red: a joker scores the most but guessed nothing. */
  const closest = $derived(view.reveal?.results.find((r) => r.guess !== null && r.points > 0) ?? null);

  const PLAYER_COLOURS: Record<string, string> = {
    mint: '#64c8b9', purple: '#b198db', orange: '#f8a171', blue: '#6ea0eb', pink: '#e89fdd',
    green: '#a9e034', yellow: '#f5d547', beige: '#d8bda4', teal: '#099f91', plum: '#9c7fcb',
  };

  let tagEl: HTMLElement | undefined = $state();

  onMount(() => {
    // A ring of red and the players' colours runs out from the tag through the dot field.
    const timer = setTimeout(() => {
      const box = tagEl?.getBoundingClientRect();
      if (!box) return;
      ripple(box.left + box.width / 2, box.top + box.height / 2, ['#dc001d', '#dc001d', ...view.players.map((p) => PLAYER_COLOURS[p.color] ?? '#dc001d')]);
    }, 260);
    return () => clearTimeout(timer);
  });
</script>

<section class="reveal">
  <header class="top">
    <span class="label">{t('round', { n: round.n, total: round.total })}</span>
  </header>

  <div class="grid">
    <div class="pic">
      <Media item={round.item} compact>
        <span class="tag-spot" bind:this={tagEl}>
          <PriceTag size="lg" caption={view.demo ? t('demoPrice') : t('realPrice')}>{formatPrice(reveal.price)}</PriceTag>
        </span>
      </Media>
      <div class="about">
        <ItemInfo item={round.item} />
        {#if reveal.url}
          <a class="ebay" href={reveal.url} target="_blank" rel="noopener noreferrer">{t('onEbay')} ↗</a>
        {/if}
      </div>
    </div>

    <div class="side">
      <div class="card board">
        <PriceLine price={reveal.price} results={reveal.results} players={view.players} />
        <ol class="results">
          {#each reveal.results as result, i (result.player)}
            {@const player = byId.get(result.player)}
            {#if player}
              <li class:me={player.id === me.id} class:top={result === closest} style:--i={i}>
                <Avatar {player} size={34} />
                <span class="who">
                  <span class="name">
                    {player.name}
                    {#if player.id === me.id}<span class="you">({t('you')})</span>{/if}
                  </span>
                  <span class="sub">
                    {#if result.joker}
                      <span class="joker">{t('joker')}</span>
                    {:else if result.guess === null}
                      {t('noGuess')}
                    {:else}
                      <span class="guess">{formatPrice(result.guess)}</span>
                      <span class="dev">{formatDeviation(result.deviation ?? 0, i18n.lang)}</span>
                    {/if}
                  </span>
                </span>
                <span class="pts">
                  {#if result.bullseye}<span class="bull">{t('bullseye')}</span>{/if}
                  <span class="gain price">+{formatPoints(result.points)}</span>
                  <span class="sum">{t('total', { points: formatPoints(player.score) })}</span>
                </span>
              </li>
            {/if}
          {/each}
        </ol>
      </div>

      {#if isHost}
        <button class="btn primary block" onclick={() => act('next')}>{last ? t('toResults') : t('next')}</button>
      {:else}
        <p class="waiting">{t('waitingFor', { name: host?.name ?? '…' })}</p>
      {/if}
    </div>
  </div>
</section>

<style>
  .reveal {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .top {
    margin-bottom: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  @media (min-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
      gap: 32px;
      align-items: start;
    }
    .pic {
      position: sticky;
      top: calc(var(--bar-h) + 16px);
    }
  }
  .pic {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .about {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tag-spot {
    position: absolute;
    left: 14px;
    bottom: 16px;
    animation: slap 0.7s var(--ewo-spring) both;
    animation-delay: 0.1s;
    transform-origin: 10% 50%;
  }
  @keyframes slap {
    from {
      opacity: 0;
      scale: 1.6;
      rotate: -18deg;
    }
  }
  .tag-spot {
    rotate: -4deg;
  }

  .ebay {
    align-self: flex-start;
    color: var(--ewo-fg-2);
    font-weight: 500;
    font-size: 14px;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .board {
    padding: 4px 16px 10px;
  }
  .results {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
  }
  .results li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--ewo-line-2);
    animation: rise 0.4s var(--ewo-ease) both;
    animation-delay: calc(0.35s + var(--i) * 0.06s);
  }
  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 8px;
    }
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .you {
    margin-left: 4px;
    color: var(--ewo-fg-3);
    font-weight: 400;
  }
  .sub {
    display: flex;
    gap: 8px;
    color: var(--ewo-fg-3);
    font-size: 13px;
  }
  .guess {
    color: var(--ewo-fg-2);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .dev {
    font-variant-numeric: tabular-nums;
  }
  .pts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  .gain {
    font-size: 20px;
    line-height: 1;
  }
  .top .gain {
    color: var(--red-text);
  }
  .sum {
    color: var(--ewo-fg-3);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .joker {
    padding: 1px 7px;
    border-radius: var(--ewo-r-pill);
    box-shadow: inset 0 0 0 1px var(--ewo-line-strong);
    color: var(--ewo-fg-2);
    font: 700 10px/1.6 var(--ewo-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .bull {
    padding: 2px 7px;
    border-radius: var(--ewo-r-pill);
    background: var(--red);
    color: #ffffff;
    font: 700 10px/1.4 var(--ewo-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
</style>
