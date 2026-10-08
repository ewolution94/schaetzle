<script lang="ts">
  import { onMount } from 'svelte';
  import type { Pick, Player, View } from '../lib/api';
  import type { Room } from '../lib/room.svelte';
  import { errorText, t } from '../lib/i18n.svelte';
  import { formatPrice, parsePrice, priceChars } from '../lib/price';
  import Media from './Media.svelte';
  import ItemInfo from './ItemInfo.svelte';
  import Avatar from './Avatar.svelte';
  import Anchor from './Anchor.svelte';
  import SortBoard from './SortBoard.svelte';

  let {
    view,
    me,
    isHost,
    room,
    act,
  }: { view: View; me: Player; isHost: boolean; room: Room; act: (action: string, body?: unknown) => Promise<boolean> } = $props();

  // Svelte remounts this per deal (Game.svelte keys it), so these start fresh every round.
  const round = $derived(view.round!);
  const mode = $derived(round.mode);
  const dealId = $derived(round.item?.id ?? round.items?.map((item) => item.id).join('+') ?? '');
  const key = $derived(`schaetzle:guess:${view.code}:${dealId}`);

  /** What you locked in, kept per deal so a reload still shows it: a price, a pick, an order, or 'joker'. */
  type Locked = number | Pick | string[] | 'joker';

  let text = $state('');
  let pick: Pick | null = $state(null);
  let order: string[] = $state([]);
  let error = $state('');
  let busy = $state(false);
  let locked: Locked | null = $state(null);
  /** The joker button asks once more before it spends one. */
  let confirming = $state(false);
  let confirmTimer = 0;
  let left = $state(0);
  let input: HTMLInputElement | undefined = $state();

  const total = $derived(view.settings.seconds * 1000);
  const elapsed = $derived(Math.max(0, total - room.left(round.endsAt)));
  const waiting = $derived(view.players.filter((p) => p.online && !p.guessed).length);
  const done = $derived(me.guessed || locked !== null);

  onMount(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) locked = JSON.parse(saved);
    } catch {
      // not kept
    }
    const tick = () => (left = room.left(round.endsAt));
    tick();
    const timer = setInterval(tick, 250);
    // A keyboard is there already on a laptop; on a phone the photo comes first.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches && !me.guessed) input?.focus({ preventScroll: true });
    return () => {
      clearInterval(timer);
      clearTimeout(confirmTimer);
    };
  });

  function remember(value: Locked) {
    locked = value;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // fine
    }
  }

  async function joker() {
    if (busy || done) return;
    if (!confirming) {
      confirming = true;
      clearTimeout(confirmTimer);
      confirmTimer = window.setTimeout(() => (confirming = false), 4000);
      return;
    }
    clearTimeout(confirmTimer);
    confirming = false;
    busy = true;
    if (await act('joker')) {
      remember('joker');
      input?.blur();
    }
    busy = false;
  }

  async function send(body: unknown, value: Locked) {
    busy = true;
    error = '';
    if (await act('guess', body)) {
      remember(value);
      input?.blur();
    }
    busy = false;
  }

  /**
   * The guess field takes digits, commas and dots only: anything else typed, pasted or dictated is
   * taken out before the field paints, with the caret kept where it was.
   */
  function typePrice(event: Event & { currentTarget: HTMLInputElement }) {
    const field = event.currentTarget;
    const clean = priceChars(field.value);
    if (clean !== field.value) {
      const caret = priceChars(field.value.slice(0, field.selectionStart ?? field.value.length)).length;
      field.value = clean;
      field.setSelectionRange(caret, caret);
    }
    text = clean;
    error = '';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || done) return;
    if (mode === 'higher') return;
    if (mode === 'sort') {
      if (order.length === round.items!.length) await send({ order }, [...order]);
      return;
    }
    const value = parsePrice(text);
    if (value === null) {
      error = errorText('guess');
      return;
    }
    await send({ value }, value);
  }

  async function choose(way: Pick) {
    if (busy || done) return;
    pick = way;
    await send({ pick: way }, way);
  }

  /** Sorting: a tap gives the next place; tapping a placed item takes it (and the places after it) back. */
  function place(id: string) {
    const at = order.indexOf(id);
    order = at > -1 ? order.slice(0, at) : [...order, id];
  }

  const seconds = $derived(Math.ceil(left / 1000));
  const urgent = $derived(left <= 5000 && left > 0);
  const ready = $derived(mode === 'higher' ? pick !== null : mode === 'sort' ? order.length === (round.items?.length ?? 0) : text.trim() !== '');
  const lockedOrder = $derived(Array.isArray(locked) ? locked : []);
</script>

{#snippet controls()}
  {#if done}
    <div class="locked" role="status">
      {#if locked === 'joker'}
        <span class="label">{t('joker')}</span>
        <span class="mine price">{t('jokerPlayed')}</span>
        <span class="hint">{t('jokerPlayedHint')} {waiting ? t('waitingOthers') : t('everyoneIn')}</span>
      {:else}
        <span class="label">{mode === 'sort' ? t('yourOrder') : t('yourGuess')}</span>
        <span class="mine price">
          {#if typeof locked === 'number'}{formatPrice(locked)}{:else if locked === 'higher' || locked === 'lower'}{t(`pick_${locked}`)}{:else}✓{/if}
        </span>
        <span class="hint">{waiting ? t('waitingOthers') : t('everyoneIn')}</span>
      {/if}
    </div>
  {:else}
    <form class="guess" onsubmit={submit}>
      {#if mode === 'higher' && round.anchor}
        <p class="question">{t('higherQuestion', { price: formatPrice(round.anchor.price) })}</p>
        <!-- One tap is the answer: the two buttons are big and far apart, and a quick call is the fun of it. -->
        <div class="picks">
          {#each ['higher', 'lower'] as const as way (way)}
            <button type="button" class="btn pick {way}" aria-pressed={pick === way} disabled={busy} onclick={() => choose(way)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
              {t(`pick_${way}`)}
            </button>
          {/each}
        </div>
      {:else if mode === 'sort'}
        <div class="sort-actions">
          <button class="btn primary block" disabled={busy || !ready}>{t('submitOrder')}</button>
          <button type="button" class="btn secondary" disabled={busy || !order.length} onclick={() => (order = [])}>{t('sortReset')}</button>
        </div>
      {:else}
        <label class="label" for="guess">{t('yourGuess')}</label>
        <div class="field">
          <input
            id="guess"
            class="input price"
            bind:this={input}
            value={text}
            inputmode="decimal"
            maxlength="13"
            autocomplete="off"
            enterkeyhint="send"
            placeholder={t('guessPlaceholder')}
            oninput={typePrice}
          />
          <span class="euro" aria-hidden="true">€</span>
        </div>
        {#if mode === 'hot'}<p class="rule">{t('hotRule')}</p>{/if}
        <button class="btn primary block" disabled={busy || !ready}>{t('submit')}</button>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if me.jokers > 0}
        <button type="button" class="btn joker block" class:confirming disabled={busy} onclick={joker}>
          {#if confirming}
            {t('jokerConfirm')}
          {:else}
            {t('useJoker')} <span class="left">{t('jokerLeft', { n: me.jokers })}</span>
          {/if}
        </button>
      {/if}
    </form>
  {/if}
{/snippet}

{#snippet people()}
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
{/snippet}

<section class="round">
  <header class="top">
    <span class="label">{t('round', { n: round.n, total: round.total })} · {t(`mode_${mode}`)}</span>
    <span class="clock price" class:urgent aria-label={t('secondsLeft', { n: seconds })}>{seconds}</span>
  </header>
  <div class="timer" aria-hidden="true">
    <span style:animation-duration="{total}ms" style:animation-delay="-{elapsed}ms"></span>
  </div>

  {#if mode === 'sort' && round.items}
    <p class="sort-hint">
      {t('sortHint')}
    </p>
    <SortBoard items={round.items} order={done ? lockedOrder : order} onpick={place} disabled={done || busy} />
    <div class="sort-side">
      <div class="sort-controls">{@render controls()}</div>
      <div class="sort-people">{@render people()}</div>
    </div>
  {:else if round.item}
    <div class="grid">
      <div class="pic">
        <Media item={round.item} />
      </div>

      <div class="side">
        {#if round.anchor}<Anchor anchor={round.anchor} />{/if}
        <ItemInfo item={round.item} />
        {@render controls()}
        {@render people()}
      </div>
    </div>
  {/if}
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

  /* The joker: quiet until it's asked about, then it says plainly what it does. */
  .joker {
    min-height: 44px;
    background: transparent;
    color: var(--ewo-fg);
    box-shadow: inset 0 0 0 1px var(--ewo-line-strong);
    font-size: 15px;
  }
  .joker .left {
    color: var(--ewo-fg-3);
    font-weight: 500;
  }
  .joker.confirming {
    background: var(--red-soft);
    color: var(--red-text);
    box-shadow: inset 0 0 0 1px var(--red-text);
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
  /* Der Preis ist heiß: the one rule, right under the field. */
  .rule {
    margin: -2px 0 2px;
    color: var(--red-text);
    font-size: 14px;
    font-weight: 600;
  }

  /* Higher or lower: two big answers, then the lock-in. */
  .question {
    margin: 0;
    font: 700 20px/1.3 var(--ewo-sans);
  }
  .picks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .pick {
    min-height: 64px;
    background: var(--surface);
    color: var(--ewo-fg);
    box-shadow: inset 0 0 0 1px var(--ewo-line-strong);
    font-size: 18px;
    font-weight: 700;
  }
  .pick svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pick.lower svg {
    rotate: 180deg;
  }
  .pick[aria-pressed='true'] {
    background: light-dark(var(--otto-ink), #ffffff);
    color: light-dark(#ffffff, var(--otto-ink));
    box-shadow: none;
  }

  /* Sorting: the four items across the page, the controls and the players below. */
  .sort-hint {
    margin: 0 0 4px;
    color: var(--ewo-fg-2);
    font-weight: 500;
  }
  .sort-side {
    display: grid;
    gap: 20px;
    margin-top: 10px;
  }
  @media (min-width: 820px) {
    .sort-side {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 32px;
      align-items: start;
    }
  }
  .sort-people {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sort-actions {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
</style>
