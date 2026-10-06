<script lang="ts">
  import type { Player, PriceRange, Settings, Theme, View } from '../lib/api';
  import { t, type Key } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';
  import Qr from './Qr.svelte';

  let {
    view,
    me,
    isHost,
    act,
  }: { view: View; me: Player; isHost: boolean; act: (action: string, body?: unknown) => Promise<boolean> } = $props();

  const THEMES: Theme[] = ['tech', 'home', 'kitchen', 'fashion', 'toys', 'collect', 'outdoor', 'garden', 'odd'];
  const PRICES: PriceRange[] = ['small', 'everyday', 'all'];

  const url = $derived(`${location.origin}/${view.code}`);
  const host = $derived(view.players.find((p) => p.id === view.host));

  // The host's choices show the moment they're tapped. They go to the server one request at a time
  // (so two quick taps can't arrive in the wrong order and undo each other), and the server's view
  // takes over again once it agrees. A refusal drops the local choices; act() says why.
  let pending: Partial<Settings> = $state({});
  let queue: Partial<Settings> = {};
  let sending: Promise<void> | null = null;
  const settings: Settings = $derived({ ...view.settings, ...pending });

  function set(patch: Partial<Settings>) {
    pending = { ...pending, ...patch };
    queue = { ...queue, ...patch };
    sending ??= flush();
  }

  async function flush() {
    while (Object.keys(queue).length) {
      const patch = queue;
      queue = {};
      if (!(await act('settings', patch))) {
        pending = {};
        queue = {};
      }
    }
    sending = null;
  }

  const same = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b) ? a.join() === b.join() : a === b);
  $effect(() => {
    const server = view.settings;
    const keys = Object.keys(pending) as (keyof Settings)[];
    const left = keys.filter((key) => !same(server[key], pending[key]));
    if (left.length !== keys.length) pending = Object.fromEntries(left.map((key) => [key, pending[key]]));
  });

  /** The theme pills toggle freely, any number of them; a game needs at least one. */
  function toggleTheme(theme: Theme) {
    const current = settings.themes;
    const next = current.includes(theme) ? current.filter((x) => x !== theme) : [...current, theme];
    set({ themes: THEMES.filter((x) => next.includes(x)) });
  }

  let starting = $state(false);
  const loading = $derived(view.phase === 'loading' || starting);
  const noThemes = $derived(settings.themes.length === 0);

  async function start() {
    starting = true;
    // Settings still on their way go first, so the game starts with what the host sees.
    if (sending) await sending;
    await act('start');
    starting = false;
  }

  let copied = $state(false);
  let qrOpen = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // No clipboard (plain HTTP, an old browser): the link is on screen to copy by hand.
      prompt(t('copyLink'), url);
    }
  }

  const notice = $derived(view.notice?.startsWith('items-failed:') ? t('notice:items', { reason: view.notice.slice(13) }) : null);
  const summary = $derived(
    [
      `${settings.rounds} ${t('rounds')}`,
      t('seconds', { n: settings.seconds }),
      t(`price_${settings.price}` as Key),
      t('jokersSummary', { n: settings.jokers }),
      settings.themes.length === THEMES.length
        ? `${t('themes')}: ${t('allThemes')}`
        : settings.themes.map((x) => t(`theme_${x}` as Key)).join(', ') || `${t('themes')}: ${t('noThemes')}`,
    ].join(' · '),
  );
</script>

<section class="lobby">
  <div class="card share">
    <p class="label">{t('shareTitle')}</p>
    <p class="code" aria-label="{t('code')} {view.code}">{view.code}</p>
    <p class="url">{url.replace(/^https?:\/\//, '')}</p>
    <div class="actions">
      <button class="btn secondary" onclick={copy}>{copied ? t('copied') : t('copyLink')}</button>
      <button class="btn secondary qr-toggle" aria-expanded={qrOpen} onclick={() => (qrOpen = !qrOpen)}>
        {qrOpen ? t('hideQr') : t('showQr')}
      </button>
    </div>
    <div class="qr" class:open={qrOpen}>
      <Qr {url} />
    </div>
    {#if view.demo}
      <p class="demo"><ewo-badge tone="accent" variant="soft" size="sm">{t('demo')}</ewo-badge> {t('demoItems')}</p>
    {/if}
  </div>

  <div class="card players">
    <p class="label">{t('players')} · {view.players.length}</p>
    <ul>
      {#each view.players as player (player.id)}
        <li class:offline={!player.online}>
          <Avatar {player} size={34} dim={!player.online} />
          <span class="name">
            {player.name}
            {#if player.id === me.id}<span class="you">({t('you')})</span>{/if}
          </span>
          {#if player.id === view.host}
            <ewo-badge tone="neutral" variant="soft" size="sm" nodot>{t('host')}</ewo-badge>
          {:else if !player.online}
            <span class="label">{t('offline')}</span>
          {/if}
          {#if isHost && player.id !== me.id}
            <button class="kick" aria-label={t('remove', { name: player.name })} onclick={() => act('kick', { player: player.id })}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <div class="card settings">
    <p class="label">{t('settings')}</p>
    {#if isHost}
      <div class="setting">
        <span>{t('rounds')}</span>
        <ewo-segmented
          tone="accent"
          label={t('rounds')}
          value={String(settings.rounds)}
          options={[5, 10, 15].map((n) => ({ value: String(n), label: String(n) }))}
          disabled={loading}
          onchange={(e) => set({ rounds: Number(e.detail.value) })}
        ></ewo-segmented>
      </div>
      <div class="setting">
        <span>{t('time')}</span>
        <ewo-segmented
          tone="accent"
          label={t('time')}
          value={String(settings.seconds)}
          options={[20, 30, 45, 60].map((n) => ({ value: String(n), label: t('seconds', { n }) }))}
          disabled={loading}
          onchange={(e) => set({ seconds: Number(e.detail.value) })}
        ></ewo-segmented>
      </div>
      <div class="setting">
        <span>{t('prices')}</span>
        <ewo-segmented
          tone="accent"
          label={t('prices')}
          value={settings.price}
          options={PRICES.map((p) => ({ value: p, label: t(`price_${p}` as Key) }))}
          disabled={loading}
          onchange={(e) => set({ price: e.detail.value as PriceRange })}
        ></ewo-segmented>
      </div>
      <div class="setting">
        <span class="named">
          {t('jokers')}
          <small>{t('jokersHint')}</small>
        </span>
        <ewo-segmented
          tone="accent"
          label={t('jokers')}
          value={String(settings.jokers)}
          options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
          disabled={loading}
          onchange={(e) => set({ jokers: Number(e.detail.value) })}
        ></ewo-segmented>
      </div>
      <div class="setting themes">
        <div class="themes-head">
          <span>{t('themes')} <span class="count">{t('themesCount', { n: settings.themes.length, total: THEMES.length })}</span></span>
          <span class="bulk">
            <button class="link" disabled={loading || settings.themes.length === THEMES.length} onclick={() => set({ themes: THEMES })}>{t('allThemes')}</button>
            <button class="link" disabled={loading || noThemes} onclick={() => set({ themes: [] })}>{t('noThemes')}</button>
          </span>
        </div>
        <div class="chips">
          {#each THEMES as theme (theme)}
            <button class="chip" aria-pressed={settings.themes.includes(theme)} disabled={loading} onclick={() => toggleTheme(theme)}>
              {t(`theme_${theme}` as Key)}
            </button>
          {/each}
        </div>
        {#if noThemes}<p class="error" role="status">{t('pickTheme')}</p>{/if}
      </div>
      <ewo-switch
        row
        tone="accent"
        checked={settings.showTitle}
        disabled={loading}
        onchange={(e) => set({ showTitle: e.detail.checked })}
      >
        {t('showTitle')}
        <span slot="hint">{t('showTitleHint')}</span>
      </ewo-switch>
    {:else}
      <p class="summary">{summary}</p>
    {/if}
  </div>

  <div class="start">
    {#if notice}<p class="error" role="alert">{notice}</p>{/if}
    {#if isHost}
      <button class="btn primary block" disabled={loading || noThemes} onclick={start}>
        {loading ? t('starting') : t('start')}
      </button>
    {:else}
      <p class="waiting">{loading ? t('starting') : t('waitingFor', { name: host?.name ?? '…' })}</p>
    {/if}
  </div>
</section>

<style>
  .lobby {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    max-width: 560px;
    margin: 0 auto;
  }
  @media (min-width: 900px) {
    .lobby {
      max-width: none;
      grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
      grid-template-areas:
        'share settings'
        'players settings'
        'players start';
      grid-template-rows: auto auto 1fr;
      align-items: start;
    }
    .share {
      grid-area: share;
    }
    .players {
      grid-area: players;
    }
    .settings {
      grid-area: settings;
    }
    .start {
      grid-area: start;
    }
  }

  .card {
    padding: 18px 20px 20px;
  }
  .card > .label {
    margin: 0 0 12px;
  }

  .share {
    text-align: center;
  }
  .code {
    margin: 4px 0 2px;
    font: 700 clamp(44px, 14vw, 64px) / 1 var(--ewo-mono);
    letter-spacing: 0.2em;
    margin-right: -0.2em;
  }
  .url {
    margin: 0 0 16px;
    color: var(--ewo-fg-3);
    font: 500 13px/1.4 var(--ewo-mono);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .actions .btn {
    flex: 1;
    min-height: 44px;
    padding: 0 12px;
    font-size: 15px;
  }
  .qr {
    display: none;
    width: min(220px, 70%);
    margin: 16px auto 0;
  }
  .qr.open {
    display: block;
  }
  /* On a big screen (the meeting room's), the code is always scannable. */
  @media (min-width: 900px) {
    .qr {
      display: block;
    }
    .qr-toggle {
      display: none;
    }
  }
  .demo {
    margin: 16px 0 0;
    color: var(--ewo-fg-3);
    font-size: 13px;
    line-height: 1.5;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .offline .name {
    color: var(--ewo-fg-3);
  }
  .you {
    margin-left: 4px;
    color: var(--ewo-fg-3);
    font-weight: 400;
  }
  .kick {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--ewo-fg-3);
  }
  .kick:hover {
    background: var(--ewo-fill-2);
    color: var(--ewo-fg);
  }
  .kick svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .settings > .label {
    margin-bottom: -4px;
  }
  .setting {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    font-weight: 500;
  }
  .setting.themes {
    flex-direction: column;
    align-items: stretch;
  }
  .named {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .named small {
    color: var(--ewo-fg-3);
    font-size: 13px;
    font-weight: 400;
  }
  .themes-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .count {
    margin-left: 6px;
    color: var(--ewo-fg-3);
    font-weight: 400;
    font-size: 13px;
  }
  .bulk {
    display: flex;
    gap: 2px;
  }
  .link {
    min-height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ewo-fg-2);
    font: 500 14px/1 var(--ewo-sans);
  }
  .link:hover:not(:disabled) {
    color: var(--ewo-fg);
    background: var(--ewo-fill-2);
  }
  .link:disabled {
    color: var(--ewo-fg-4);
    cursor: default;
  }
  .themes .error {
    margin: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 36px;
    padding: 0 14px;
    border: 1px solid var(--ewo-line);
    border-radius: var(--ewo-r-pill);
    background: transparent;
    font: 500 14px/1 var(--ewo-sans);
    -webkit-tap-highlight-color: transparent;
  }
  .chip[aria-pressed='true'] {
    background: var(--ewo-invert);
    border-color: var(--ewo-invert);
    color: var(--ewo-invert-ink);
  }
  .chip:active:not(:disabled) {
    transform: scale(0.96);
  }
  .chip:disabled {
    opacity: 0.5;
  }
  .summary {
    margin: 0;
    color: var(--ewo-fg-2);
    line-height: 1.6;
  }

  .start {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* On the phone the start button stays in reach while the host scrolls the settings. */
  @media (max-width: 899px) {
    .start {
      position: sticky;
      bottom: 12px;
      z-index: 2;
    }
    .start .btn {
      box-shadow: 0 10px 24px -8px rgb(150 0 20 / 0.45);
    }
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
