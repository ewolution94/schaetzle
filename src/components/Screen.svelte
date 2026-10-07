<script lang="ts">
  // The big screen: the room as the meeting room's projector (or a shared screen in a call) shows
  // it. It watches without a seat, so it never counts as a player, and it has no controls: the host
  // plays and runs the game on their phone. Everything is sized to the screen, without scrolling.
  import { onMount } from 'svelte';
  import type { Player } from '../lib/api';
  import { Room } from '../lib/room.svelte';
  import { i18n, t, type Key } from '../lib/i18n.svelte';
  import { formatDeviation, formatPoints, formatPrice } from '../lib/price';
  import Avatar from './Avatar.svelte';
  import Media from './Media.svelte';
  import ItemInfo from './ItemInfo.svelte';
  import PriceTag from './PriceTag.svelte';
  import PriceLine from './PriceLine.svelte';
  import Anchor from './Anchor.svelte';
  import SortBoard from './SortBoard.svelte';
  import TeamBoard from './TeamBoard.svelte';
  import Qr from './Qr.svelte';

  let { code }: { code: string } = $props();

  // A seat without a player: the stream's `p` stays empty. App.svelte keys this component by the
  // code, so a different room is a new component.
  // svelte-ignore state_referenced_locally
  const room = new Room({ code, player: '', token: '' });
  const view = $derived(room.view);
  const url = $derived(`${location.origin}/${code}`);
  const shortUrl = $derived(url.replace(/^https?:\/\//, ''));
  const round = $derived(view?.round ?? null);
  const reveal = $derived(view?.reveal ?? null);
  const mode = $derived(round?.mode ?? view?.settings.mode ?? 'classic');
  const byId = $derived(new Map((view?.players ?? []).map((p) => [p.id, p])));
  const host = $derived(view?.players.find((p) => p.id === view.host));
  const ranked = $derived([...(view?.players ?? [])].sort((a, b) => b.score - a.score));

  let left = $state(0);
  const seconds = $derived(Math.ceil(left / 1000));
  const total = $derived((view?.settings.seconds ?? 30) * 1000);
  const elapsed = $derived(round ? Math.max(0, total - room.left(round.endsAt)) : 0);
  const inCount = $derived(view?.players.filter((p) => p.guessed).length ?? 0);

  // Sorting at the reveal: the four in their real order.
  const sorted = $derived(
    reveal?.items && round?.items ? reveal.items.map((x) => round.items!.find((item) => item.id === x.id)!).filter(Boolean) : [],
  );
  const prices = $derived(new Map((reveal?.items ?? []).map((x) => [x.id, x.price])));
  const closest = $derived(reveal?.results.find((r) => !r.joker && r.points > 0 && !r.over) ?? null);
  /** How many players' rows fit beside the photo: fewer when the teams' standings need the room. */
  const rows = $derived(view?.teams ? Math.max(2, 6 - view.teams.length) : 8);
  const rightWay = $derived(
    round?.anchor && reveal && reveal.price !== null ? (reveal.price > round.anchor.price ? 'higher' : reveal.price < round.anchor.price ? 'lower' : 'both') : null,
  );

  // With teams in the lobby: everyone under their team.
  const teamCount = $derived(view?.settings.teams ?? 0);
  const grouped = $derived(!!view && teamCount > 0 && view.players.every((p) => p.team !== null && p.team < teamCount));

  const teamTotals = $derived(view?.game?.teams && view.teams ? view.teams : null);
  const teamOrder = $derived(teamTotals ? teamTotals.map((score, team) => ({ team, score })).sort((a, b) => b.score - a.score) : []);
  const finalTitle = $derived.by(() => {
    if (teamTotals) {
      if (teamOrder.length > 1 && teamOrder[0].score === teamOrder[1].score) return t('teamTie');
      return t('teamWins', { name: t(`team_${teamOrder[0].team}` as Key) });
    }
    if (ranked.length > 1 && ranked[0].score === ranked[1].score) return t('tie');
    return t('winner', { name: ranked[0]?.name ?? '' });
  });

  onMount(() => {
    room.connect();
    const timer = setInterval(() => (left = round ? room.left(round.endsAt) : 0), 250);

    // A projector shouldn't dim in the middle of a round.
    let lock: { release(): Promise<void> } | null = null;
    const awake = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        // not allowed (battery saver, an old browser): the screen may dim
      }
    };
    void awake();
    document.addEventListener('visibilitychange', awake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', awake);
      void lock?.release().catch(() => {});
      room.close();
    };
  });
</script>

{#snippet people(players: Player[], size: number, checks: boolean)}
  <ul class="people">
    {#each players as player (player.id)}
      <li>
        <Avatar {player} {size} check={checks && player.guessed} dim={!player.online} />
        <span class="person">{player.name}</span>
      </li>
    {/each}
  </ul>
{/snippet}

<div class="screen">
  <header class="head">
    <span class="brand">
      <img src="/icon.svg" alt="" width="36" height="36" />
      <span class="word">Schätzle</span>
      {#if view && view.phase !== 'lobby' && view.phase !== 'gone'}
        <span class="label">{t(`mode_${mode}`)}{round ? ` · ${t('round', { n: round.n, total: round.total })}` : ''}</span>
      {/if}
    </span>
    {#if view && view.phase !== 'lobby' && view.phase !== 'gone'}
      <span class="join-small">
        <span>{t('screenPlayAt')} <strong>{shortUrl}</strong></span>
        <span class="mini-qr"><Qr {url} /></span>
      </span>
    {/if}
  </header>

  {#if !view}
    <p class="center label">…</p>
  {:else if view.phase === 'gone'}
    <div class="center"><h1>{t('gone')}</h1></div>
  {:else if view.phase === 'lobby' || view.phase === 'loading'}
    <div class="lobby">
      <div class="invite">
        <p class="label">{t('screenScan')}</p>
        <div class="big-qr"><Qr {url} /></div>
        <p class="code price">{code}</p>
        <p class="url">{shortUrl}</p>
      </div>
      <div class="room">
        <div class="mode-card card">
          <p class="label">{t('mode')}</p>
          <h2>{t(`mode_${view.settings.mode}`)}</h2>
          <p>{t(`mode_${view.settings.mode}_hint`)}</p>
        </div>
        <div class="card who-card">
          <p class="label">{t('players')} · {view.players.length}</p>
          {#if grouped}
            <div class="lobby-teams">
              {#each Array.from({ length: teamCount }, (_, i) => i) as team (team)}
                <section class="team team-{team}">
                  <h3><span class="dot"></span>{t('teamName', { name: t(`team_${team}` as Key) })}</h3>
                  {@render people(view.players.filter((p) => p.team === team), 52, false)}
                </section>
              {/each}
            </div>
          {:else}
            {@render people(view.players, 64, false)}
          {/if}
        </div>
        <p class="status">{view.phase === 'loading' ? t('starting') : t('waitingFor', { name: host?.name ?? '…' })}</p>
      </div>
    </div>
  {:else if view.phase === 'guess' && round}
    <div class="stage" class:sorting={mode === 'sort'}>
      {#if mode === 'sort' && round.items}
        <p class="prompt">{t('sortHint')}</p>
        <SortBoard items={round.items} big />
      {:else if round.item}
        <div class="pic"><Media item={round.item} /></div>
        <div class="side">
          {#if round.anchor}
            <Anchor anchor={round.anchor} big />
            <p class="prompt">{t('higherQuestion', { price: formatPrice(round.anchor.price) })}</p>
          {/if}
          <div class="info"><ItemInfo item={round.item} /></div>
          {#if mode === 'hot'}<p class="rule">{t('hotRule')}</p>{/if}
        </div>
      {/if}
      <div class="clockline">
        <span class="clock price" class:urgent={left <= 5000 && left > 0}>{seconds}</span>
        <div class="timer" aria-hidden="true">
          {#key round.endsAt}
            <span style:animation-duration="{total}ms" style:animation-delay="-{elapsed}ms"></span>
          {/key}
        </div>
        <span class="label">{t('screenIn', { n: inCount, total: view.players.length })}</span>
      </div>
      <div class="guessers">{@render people(view.players, 60, true)}</div>
    </div>
  {:else if view.phase === 'reveal' && round && reveal}
    <div class="stage reveal" class:sorting={mode === 'sort'}>
      {#if mode === 'sort'}
        <div class="sort-pic">
          <p class="prompt">{t('realOrder')}</p>
          <SortBoard items={sorted} {prices} big />
        </div>
      {:else if round.item && reveal.price !== null}
        <div class="pic">
          <Media item={round.item}>
            <span class="tag-spot">
              <PriceTag size="xl" caption={view.demo ? t('demoPrice') : t('realPrice')}>{formatPrice(reveal.price)}</PriceTag>
            </span>
          </Media>
        </div>
      {/if}
      <div class="side scores">
        {#if mode === 'higher' && round.anchor}
          <Anchor anchor={round.anchor} then={reveal.price} big />
          <div class="split">
            {#each ['higher', 'lower'] as const as way (way)}
              <div class="side-of" class:ok={rightWay === way || rightWay === 'both'}>
                <span class="way-label">{t(`pick_${way}`)}</span>
                <span class="voters">
                  {#each reveal.results.filter((r) => !r.joker && r.pick === way) as r (r.player)}
                    {@const player = byId.get(r.player)}
                    {#if player}<Avatar {player} size={40} />{/if}
                  {/each}
                </span>
              </div>
            {/each}
          </div>
        {:else if mode !== 'sort' && reveal.price !== null}
          <div class="card line"><PriceLine price={reveal.price} results={reveal.results} players={view.players} hot={mode === 'hot'} /></div>
        {/if}
        <ol class="results">
          {#each reveal.results.slice(0, rows) as result (result.player)}
            {@const player = byId.get(result.player)}
            {#if player}
              <li class:top={result === closest}>
                <Avatar {player} size={36} />
                <span class="person">{player.name}</span>
                <span class="what">
                  {#if result.joker}{t('joker')}
                  {:else if mode === 'higher'}{result.pick ? `${t(`pick_${result.pick}`)} · ${result.right ? t('right') : t('wrong')}` : t('noGuess')}
                  {:else if mode === 'sort'}{result.order ? t('pairs', { n: result.pairs ?? 0 }) : t('noGuess')}
                  {:else if typeof result.guess === 'number'}{formatPrice(result.guess)} · {result.over ? t('over') : formatDeviation(result.deviation ?? 0, i18n.lang)}
                  {:else}{t('noGuess')}{/if}
                </span>
                <span class="gain price">+{formatPoints(result.points)}</span>
                <span class="sum price">{formatPoints(player.score)}</span>
              </li>
            {/if}
          {/each}
        </ol>
        {#if view.teams && reveal.teams}
          <div class="card team-card"><TeamBoard totals={view.teams} gains={reveal.teams} players={view.players} big /></div>
        {/if}
      </div>
    </div>
  {:else if view.phase === 'final'}
    <div class="final">
      <p class="label">{t('results')}</p>
      <h1>{finalTitle}</h1>
      <div class="final-grid" class:with-teams={teamTotals}>
        {#if teamTotals}
          <div class="card team-card"><TeamBoard totals={teamTotals} players={view.players} big /></div>
        {/if}
        <ol class="ranking">
          {#each ranked.slice(0, 10) as player, i (player.id)}
            <li class:first={i === 0}>
              <span class="rank price">{ranked.findIndex((q) => q.score === player.score) + 1}</span>
              <Avatar {player} size={i === 0 ? 56 : 40} />
              <span class="person">{player.name}</span>
              <span class="sum price">{formatPoints(player.score)}</span>
            </li>
          {/each}
        </ol>
      </div>
    </div>
  {/if}
</div>

<style>
  /* One unit that grows with the screen: a laptop shared in a call and a 4K projector both fit. */
  .screen {
    --u: clamp(9px, 0.9vw, 22px);
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: calc(var(--u) * 2);
    min-height: 100dvh;
    padding: calc(var(--u) * 2) calc(var(--u) * 3);
    font-size: calc(var(--u) * 1.6);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: calc(var(--u) * 1.2);
  }
  .brand img {
    width: calc(var(--u) * 3.4);
    height: calc(var(--u) * 3.4);
  }
  .word {
    font: 800 calc(var(--u) * 2.4) / 1 var(--ewo-sans);
    letter-spacing: -0.02em;
  }
  .brand .label,
  .screen .label {
    font-size: calc(var(--u) * 1.2);
  }
  .join-small {
    display: flex;
    align-items: center;
    gap: calc(var(--u) * 1.4);
    color: var(--ewo-fg-2);
    font-size: calc(var(--u) * 1.4);
  }
  .join-small strong {
    color: var(--ewo-fg);
    font-family: var(--ewo-mono);
  }
  .mini-qr {
    width: calc(var(--u) * 7);
  }

  .center {
    flex: 1;
    display: grid;
    place-items: center;
    text-align: center;
  }
  h1 {
    margin: 0;
    font: 800 calc(var(--u) * 4.6) / 1.1 var(--ewo-sans);
    letter-spacing: -0.03em;
  }

  /* ---- lobby ---- */
  .lobby {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: calc(var(--u) * 4);
    align-items: center;
  }
  .invite {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .invite .label {
    margin: 0 0 calc(var(--u) * 1.4);
  }
  .big-qr {
    width: min(calc(var(--u) * 34), 60vh);
  }
  .code {
    margin: calc(var(--u) * 2) 0 0;
    font-size: calc(var(--u) * 8);
    line-height: 1;
    letter-spacing: 0.18em;
    margin-right: -0.18em;
  }
  .url {
    margin: calc(var(--u) * 0.8) 0 0;
    color: var(--ewo-fg-3);
    font: 500 calc(var(--u) * 1.8) / 1.3 var(--ewo-mono);
  }
  .room {
    display: flex;
    flex-direction: column;
    gap: calc(var(--u) * 2);
  }
  .mode-card,
  .who-card {
    padding: calc(var(--u) * 2) calc(var(--u) * 2.4);
  }
  .mode-card .label,
  .who-card .label {
    margin: 0 0 calc(var(--u) * 0.8);
  }
  .mode-card h2 {
    margin: 0;
    font: 800 calc(var(--u) * 3.2) / 1.1 var(--ewo-sans);
    letter-spacing: -0.02em;
    color: var(--red-text);
  }
  .mode-card p:last-child {
    margin: calc(var(--u) * 0.6) 0 0;
    color: var(--ewo-fg-2);
    font-size: calc(var(--u) * 1.8);
  }
  .status {
    margin: 0;
    color: var(--ewo-fg-2);
    font-size: calc(var(--u) * 1.8);
  }
  .lobby-teams {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: calc(var(--u) * 2);
  }
  .team h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 calc(var(--u) * 1);
    padding-bottom: calc(var(--u) * 0.6);
    border-bottom: 3px solid var(--team);
    font: 700 calc(var(--u) * 1.8) / 1.2 var(--ewo-sans);
  }
  .team .dot {
    width: calc(var(--u) * 1.1);
    height: calc(var(--u) * 1.1);
    border-radius: 50%;
    background: var(--team);
  }

  .people {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--u) * 1.4) calc(var(--u) * 1.2);
  }
  .people li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: calc(var(--u) * 7.5);
    animation: pop 0.4s var(--ewo-ease-spring) both;
  }
  @keyframes pop {
    from {
      scale: 0.6;
      opacity: 0;
    }
  }
  .person {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: calc(var(--u) * 1.4);
  }

  /* ---- a round and its reveal ---- */
  .stage {
    flex: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto auto;
    gap: calc(var(--u) * 1.6) calc(var(--u) * 4);
    min-height: 0;
  }
  .stage .pic {
    grid-row: 1 / 4;
    height: min(calc(100dvh - var(--u) * 12), 56vw);
    aspect-ratio: 1;
    max-width: 52vw;
  }
  .stage .pic :global(.media) {
    height: 100%;
    aspect-ratio: 1;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: calc(var(--u) * 1.6);
    min-width: 0;
  }
  .info :global(h2) {
    font-size: calc(var(--u) * 2.6);
  }
  .info :global(.chip) {
    font-size: calc(var(--u) * 1.3);
  }
  .prompt {
    margin: 0;
    font: 700 calc(var(--u) * 2.4) / 1.25 var(--ewo-sans);
  }
  .rule {
    margin: 0;
    color: var(--red-text);
    font-weight: 700;
    font-size: calc(var(--u) * 2);
  }
  .clockline {
    display: flex;
    align-items: center;
    gap: calc(var(--u) * 1.6);
  }
  .clock {
    min-width: 2ch;
    font-size: calc(var(--u) * 5);
    line-height: 1;
  }
  .clock.urgent {
    color: var(--red-text);
  }
  .timer {
    flex: 1;
    height: calc(var(--u) * 0.8);
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-2);
    overflow: hidden;
  }
  .timer span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--red);
    transform-origin: left;
    animation-name: drain;
    animation-timing-function: linear;
    animation-fill-mode: both;
  }
  @keyframes drain {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  .stage.sorting {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    align-content: start;
  }
  .stage.sorting :global(.board) {
    max-width: calc((100dvh - var(--u) * 26) * 4 * 0.82);
    width: 100%;
    margin: 0 auto;
  }
  /* The sorted four, two by two on the left (like the photo in the other modes), the scores right. */
  .stage.reveal.sorting {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }
  .sort-pic {
    display: flex;
    flex-direction: column;
    gap: calc(var(--u) * 1.2);
    /* Two rows of a square photo plus its price and title have to fit the screen's height. */
    width: min(calc(100dvh - var(--u) * 14 - 16vw), 50vw);
  }
  .stage.reveal.sorting .sort-pic :global(.board.big) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: none;
  }

  .tag-spot {
    position: absolute;
    left: calc(var(--u) * 2);
    bottom: calc(var(--u) * 2);
    rotate: -4deg;
    animation: slap 0.7s var(--ewo-spring) 0.1s both;
    transform-origin: 10% 50%;
  }
  @keyframes slap {
    from {
      opacity: 0;
      scale: 1.6;
      rotate: -18deg;
    }
  }

  .scores {
    gap: calc(var(--u) * 1.4);
  }
  .stage.reveal .scores {
    grid-row: 1 / 4;
    overflow: hidden;
  }
  .stage.reveal.sorting .scores {
    grid-row: auto;
  }
  .line {
    padding: 0 calc(var(--u) * 1.6) calc(var(--u) * 1);
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .results li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
    align-items: center;
    gap: calc(var(--u) * 1.2);
    padding: calc(var(--u) * 0.5) 0;
    border-top: 1px solid var(--ewo-line-2);
  }
  .results .person {
    font-size: calc(var(--u) * 1.6);
  }
  .results .what {
    color: var(--ewo-fg-3);
    font-size: calc(var(--u) * 1.3);
    font-variant-numeric: tabular-nums;
  }
  .gain {
    font-size: calc(var(--u) * 2);
  }
  .results .top .gain {
    color: var(--red-text);
  }
  .sum {
    min-width: 4ch;
    text-align: right;
    color: var(--ewo-fg-3);
    font-size: calc(var(--u) * 1.4);
  }
  .team-card {
    padding: calc(var(--u) * 1.2) calc(var(--u) * 1.8);
  }
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(var(--u) * 1.2);
  }
  .side-of {
    display: flex;
    flex-direction: column;
    gap: calc(var(--u) * 0.8);
    min-height: calc(var(--u) * 6.5);
    padding: calc(var(--u) * 1.2);
    border-radius: var(--radius);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--ewo-line-2);
  }
  .side-of.ok {
    background: var(--red-soft);
    box-shadow: inset 0 0 0 3px var(--red);
  }
  .way-label {
    font: 800 calc(var(--u) * 2) / 1 var(--ewo-sans);
  }
  .voters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* ---- the end ---- */
  .final {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--u) * 1.2);
    text-align: center;
  }
  .final .label {
    margin: 0;
  }
  .final-grid {
    display: grid;
    gap: calc(var(--u) * 3);
    width: min(100%, calc(var(--u) * 60));
    margin-top: calc(var(--u) * 2);
    text-align: left;
  }
  .final-grid.with-teams {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: min(100%, calc(var(--u) * 110));
    align-items: start;
  }
  .ranking {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .ranking li {
    display: grid;
    grid-template-columns: calc(var(--u) * 3) auto minmax(0, 1fr) auto;
    align-items: center;
    gap: calc(var(--u) * 1.4);
    padding: calc(var(--u) * 0.8) 0;
    border-top: 1px solid var(--ewo-line-2);
  }
  .ranking li:first-child {
    border-top: 0;
  }
  .ranking .rank {
    color: var(--ewo-fg-3);
    font-size: calc(var(--u) * 1.8);
  }
  .ranking .person {
    font-size: calc(var(--u) * 2);
  }
  .ranking .sum {
    color: var(--ewo-fg);
    font-size: calc(var(--u) * 2.2);
  }
  .ranking .first .rank,
  .ranking .first .sum {
    color: var(--red-text);
  }
  .ranking .first .person {
    font-size: calc(var(--u) * 2.6);
    font-weight: 800;
  }

  /* A phone or a narrow window opening the screen view: everything stacks and the page scrolls. */
  @media (max-width: 760px), (orientation: portrait) {
    .screen {
      --u: 9px;
    }
    .lobby,
    .stage,
    .stage.reveal.sorting .scores,
    .final-grid.with-teams {
      grid-template-columns: minmax(0, 1fr);
    }
    .stage .pic {
      grid-row: auto;
      height: auto;
      width: 100%;
      max-width: none;
    }
    .stage.reveal .scores {
      grid-row: auto;
    }
    .stage.sorting :global(.board) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-width: none;
    }
    .join-small > span:first-child {
      display: none;
    }
  }
</style>
