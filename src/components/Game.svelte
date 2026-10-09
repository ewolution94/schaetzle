<script lang="ts">
  // One room: the screen for its phase, plus what every phase shares (the connection, being gone).
  import { ApiError } from '../lib/api';
  import type { Room } from '../lib/room.svelte';
  import { errorText, t } from '../lib/i18n.svelte';
  import { toast } from '../../vendor/ewo/elements/toaster.js';
  import { actAt } from '../lib/waits';
  import { TAG_MARK } from '../lib/mark';
  import Lobby from './Lobby.svelte';
  import Round from './Round.svelte';
  import Reveal from './Reveal.svelte';
  import Final from './Final.svelte';

  let { room, onleave, onrejoin }: { room: Room; onleave: () => void; onrejoin: () => void } = $props();

  const view = $derived(room.view);
  const me = $derived(view?.players.find((p) => p.id === room.seat.player) ?? null);
  const isHost = $derived(view?.host === room.seat.player);

  /**
   * A move, waited for at the control that made it (`from`: its click or submit event; lib/waits.ts).
   * A refusal shows as a toast (the view itself is what the stream says). False when it didn't go
   * through, or when the control was already waiting.
   */
  async function act(action: string, body?: unknown, from?: Event | Element | null) {
    try {
      return (await actAt(room, action, body, from)) === true;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'other';
      if (code === 'no-player') onrejoin();
      else toast(errorText(code), { tone: 'bad' });
      return false;
    }
  }

  // Each new screen (a new round, the reveal, the results) starts at the top, wherever the last
  // one was scrolled to.
  /** The round's item, or its four items when sorting: a new deal is a new round screen. */
  const deal = $derived(view?.round ? (view.round.item?.id ?? view.round.items?.map((item) => item.id).join('+') ?? '') : '');
  const screen = $derived(view ? `${view.phase}:${view.round?.n ?? ''}:${deal}` : '');
  let lastScreen = '';
  $effect(() => {
    if (screen && screen !== lastScreen) {
      if (lastScreen) scrollTo({ top: 0, behavior: 'instant' });
      lastScreen = screen;
    }
  });

  async function leave(event: Event) {
    // Out either way: a seat the server doesn't hear about leaves the lobby on its own.
    await actAt(room, 'leave', undefined, event).catch(() => {});
    onleave();
  }

  /** The connection pill (Folio's <ewo-connection>): quiet for a blip, never over a game that's gone. */
  const connection = $derived(room.live || view?.phase === 'gone' ? 'online' : room.wasLive ? 'reconnecting' : 'connecting');
</script>

<ewo-connection state={connection}><span slot="mark">{@html TAG_MARK}</span></ewo-connection>

{#if !view}
  <p class="status label" aria-live="polite">…</p>
{:else if view.phase === 'gone'}
  <section class="gone">
    <h1>{t('gone')}</h1>
    <button class="btn secondary" onclick={onleave}>{t('home')}</button>
  </section>
{:else if !me}
  <section class="gone">
    <h1>{t('error:no-player')}</h1>
    <button class="btn primary" onclick={onrejoin}>{t('join')}</button>
    <button class="btn quiet" onclick={onleave}>{t('home')}</button>
  </section>
{:else}
  {#if view.phase === 'lobby' || view.phase === 'loading'}
    <Lobby {view} {me} {isHost} {act} />
  {:else if view.phase === 'guess' && view.round}
    {#key deal}
      <Round {view} {me} {isHost} {room} {act} />
    {/key}
  {:else if view.phase === 'reveal' && view.round && view.reveal}
    <Reveal {view} {me} {isHost} {act} />
  {:else if view.phase === 'final'}
    <Final {view} {me} {isHost} {act} />
  {/if}

  <div class="leave">
    <button class="btn quiet" onclick={(e) => leave(e)}>{t('leave')}</button>
  </div>
{/if}

<style>
  .status {
    text-align: center;
    padding: 80px 0;
  }
  .gone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 80px 0;
    text-align: center;
  }
  h1 {
    margin: 0;
    font: 700 22px/1.3 var(--ewo-sans);
  }

  .leave {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
</style>
