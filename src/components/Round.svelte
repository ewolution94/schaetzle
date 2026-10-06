<script lang="ts">
  import { onMount } from 'svelte';
  import type { Player, View } from '../lib/api';
  import type { Room } from '../lib/room.svelte';
  import { errorText, t } from '../lib/i18n.svelte';
  import { formatPrice, parsePrice } from '../lib/price';
  import Media from './Media.svelte';
  import ItemInfo from './ItemInfo.svelte';
  import Avatar from './Avatar.svelte';

  let {
    view,
    me,
    isHost,
    room,
    act,
  }: { view: View; me: Player; isHost: boolean; room: Room; act: (action: string, body?: unknown) => Promise<boolean> } = $props();

  // Svelte remounts this per item (Game.svelte keys it), so these start fresh every round.
  const round = $derived(view.round!);
  const key = $derived(`schaetzle:guess:${view.code}:${round.item.id}`);

  let text = $state('');
  let error = $state('');
  let busy = $state(false);
  /** What you locked in, kept per item so a reload still shows it. */
  let locked: number | null = $state(null);
  let left = $state(0);
  let input: HTMLInputElement | undefined = $state();

  const total = $derived(view.settings.seconds * 1000);
  const elapsed = $derived(Math.max(0, total - room.left(round.endsAt)));
  const waiting = $derived(view.players.filter((p) => p.online && !p.guessed).length);
  const done = $derived(me.guessed || locked !== null);

  onMount(() => {
    try {
      const saved = Number(sessionStorage.getItem(key));
      if (saved > 0) locked = saved;
    } catch {
      // not kept
    }
    const tick = () => (left = room.left(round.endsAt));
    tick();
    const timer = setInterval(tick, 250);
    // A keyboard is there already on a laptop; on a phone the photo comes first.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches && !me.guessed) input?.focus({ preventScroll: true });
    return () => clearInterval(timer);
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || done) return;
    const value = parsePrice(text);
    if (value === null) {
      error = errorText('guess');
      return;
    }
    busy = true;
    error = '';
    if (await act('guess', { value })) {
      locked = value;
      try {
        sessionStorage.setItem(key, String(value));
      } catch {
        // fine
      }
      input?.blur();
    }
    busy = false;
  }

  const seconds = $derived(Math.ceil(left / 1000));
  const urgent = $derived(left <= 5000 && left > 0);
</script>

<section class="round">
  <header class="top">
    <span class="label">{t('round', { n: round.n, total: round.total })}</span>
    <span class="clock price" class:urgent aria-label={t('secondsLeft', { n: seconds })}>{seconds}</span>
  </header>
  <div class="timer" aria-hidden="true">
    <span style:animation-duration="{total}ms" style:animation-delay="-{elapsed}ms"></span>
  </div>

  <div class="grid">
    <div class="pic">
      <Media item={round.item} />
    </div>

    <div class="side">
      <ItemInfo item={round.item} />

      {#if done}
        <div class="locked" role="status">
          <span class="label">{t('yourGuess')}</span>
          <span class="mine price">{locked !== null ? formatPrice(locked) : '✓'}</span>
          <span class="hint">{waiting ? t('waitingOthers') : t('everyoneIn')}</span>
        </div>
      {:else}
        <form class="guess" onsubmit={submit}>
          <label class="label" for="guess">{t('yourGuess')}</label>
          <div class="field">
            <input
              id="guess"
              class="input price"
              bind:this={input}
              bind:value={text}
              inputmode="decimal"
              autocomplete="off"
              enterkeyhint="send"
              placeholder={t('guessPlaceholder')}
              oninput={() => (error = '')}
            />
            <span class="euro" aria-hidden="true">€</span>
          </div>
          <button class="btn primary block" disabled={busy || !text.trim()}>{t('submit')}</button>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
        </form>
      {/if}

      <ul class="who" aria-label={t('players')}>
        {#each view.players as player (player.id)}
          <li class:me={player.id === me.id}>
            <Avatar {player} size={36} check={player.guessed} dim={!player.online} />
            <span class="name">{player.name}</span>
          </li>
        {/each}
      </ul>

      {#if isHost && round.skips > 0}
        <button class="btn quiet skip" onclick={() => act('skip')}>
          {t('skip')} <span class="label">{t('skipsLeft', { n: round.skips })}</span>
        </button>
      {/if}
    </div>
  </div>
</section>

<style>
  .round {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: enter 0.45s var(--ewo-ease) both;
  }
  @keyframes enter {
    from {
      opacity: 0;
      translate: 0 12px;
    }
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .clock {
    font-size: 22px;
    min-width: 2ch;
    text-align: right;
  }
  .clock.urgent {
    color: var(--red-text);
  }

  /* The timer runs on the compositor: one linear animation, started where the round already is. */
  .timer {
    height: 6px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-2);
    overflow: hidden;
    margin-bottom: 6px;
  }
  .timer span {
    display: block;
    height: 100%;
    background: var(--red);
    border-radius: inherit;
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

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  @media (min-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 32px;
      align-items: start;
    }
    .pic {
      position: sticky;
      top: calc(var(--bar-h) + 16px);
    }
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .guess {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .field {
    position: relative;
  }
  .field .input {
    min-height: 64px;
    padding-right: 48px;
    font-size: 30px;
    font-weight: 800;
  }
  .euro {
    position: absolute;
    right: 18px;
    top: 50%;
    translate: 0 -50%;
    font: 800 26px/1 var(--ewo-sans);
    color: var(--ewo-fg-3);
    pointer-events: none;
  }

  .locked {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 18px;
    border-radius: var(--radius);
    background: var(--red-soft);
    animation: enter 0.35s var(--ewo-ease) both;
  }
  .mine {
    font-size: 34px;
    line-height: 1.1;
    color: var(--red-text);
  }
  .hint {
    color: var(--ewo-fg-2);
    font-size: 14px;
  }

  .who {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 10px;
  }
  .who li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 56px;
  }
  .who .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--ewo-fg-2);
  }
  .who .me .name {
    color: var(--ewo-fg);
    font-weight: 600;
  }
  .skip {
    align-self: flex-start;
    gap: 8px;
  }
</style>
