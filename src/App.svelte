<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError, CODE, type Config, type Seat } from './lib/api';
  import { Room } from './lib/room.svelte';
  import { forgetSeat, saveName, savedSeat, saveSeat } from './lib/session';
  import { loadCensus } from './lib/census';
  import Field from './components/Field.svelte';
  import Bar from './components/Bar.svelte';
  import Home from './components/Home.svelte';
  import Join from './components/Join.svelte';
  import Game from './components/Game.svelte';
  import Footer from './components/Footer.svelte';

  // The whole app is one page. "/" is the start; "/KXPT" is a room, and the link people share.
  let path = $state(location.pathname);
  const code = $derived(codeFrom(path));
  let room: Room | null = $state.raw(null);
  let config: Config | null = $state.raw(null);
  /** Arriving at a room with a saved seat: reclaiming it before anything shows. */
  let reclaiming = $state(false);

  function codeFrom(p: string) {
    const segment = p.replace(/^\/+|\/+$/g, '').toUpperCase();
    return CODE.test(segment) ? segment : null;
  }

  function go(to: string, replace = false) {
    if (location.pathname !== to) history[replace ? 'replaceState' : 'pushState'](null, '', to);
    path = to;
  }

  function enter(seat: Seat) {
    saveSeat(seat);
    room?.close();
    room = new Room(seat);
    room.connect();
    go(`/${seat.code}`);
  }

  function leaveRoom() {
    if (room) forgetSeat(room.seat.code);
    room?.close();
    room = null;
    go('/');
  }

  /** Removed from a room (kicked, or gone too long in the lobby): drop the seat and ask for a name again. */
  function rejoin() {
    if (room) forgetSeat(room.seat.code);
    room?.close();
    room = null;
  }

  /** Coming back to a room's link: take the saved seat again (the server checks it). */
  async function reclaim(c: string) {
    const seat = savedSeat(c);
    if (!seat) return;
    reclaiming = true;
    try {
      enter(await api.join(c, '', seat.token));
    } catch (error) {
      if (error instanceof ApiError && error.code !== 'offline') forgetSeat(c);
    } finally {
      reclaiming = false;
    }
  }

  $effect(() => {
    // Leaving a room by navigating (back button) closes its stream.
    if (room && room.seat.code !== code) {
      room.close();
      room = null;
    }
    if (code && !room) void reclaim(code);
  });

  onMount(() => {
    // An unknown path (an old link, a typo) is the start page.
    if (!code && path !== '/') go('/', true);
    const onPop = () => (path = location.pathname);
    addEventListener('popstate', onPop);
    api.config().then((c) => (config = c), () => {});
    loadCensus();
    return () => removeEventListener('popstate', onPop);
  });
</script>

<Field />
<Bar code={room ? room.seat.code : null} />

<main>
  {#if room}
    <Game {room} onleave={leaveRoom} onrejoin={rejoin} />
  {:else if code}
    {#if !reclaiming}
      <Join
        {code}
        onjoin={(seat, name) => {
          saveName(name);
          enter(seat);
        }}
        onback={() => go('/')}
      />
    {/if}
  {:else}
    <Home
      demo={config?.demo ?? false}
      oncreate={(seat, name) => {
        saveName(name);
        enter(seat);
      }}
      onjoin={(c) => go(`/${c}`)}
    />
  {/if}
</main>

<Footer />

<style>
  main {
    position: relative;
    z-index: 1;
    max-width: var(--page);
    min-height: calc(100dvh - var(--bar-h) - 120px);
    margin: 0 auto;
    padding: 8px var(--gutter) 48px;
  }

  /* In the browser (not installed), Safari's toolbar floats over the bottom of the page. */
  @media not (display-mode: standalone) {
    @supports (-webkit-touch-callout: none) {
      main {
        padding-bottom: 96px;
      }
    }
  }
</style>
