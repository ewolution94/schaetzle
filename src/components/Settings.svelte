<!--
  Settings, the family's way (plans/settings-alignment.md): Folio's ewo-sheet, opened from the
  bar's ewo-settings-button, with General (ewo-settings-basics: Language and Theme). The game's own
  settings live in the lobby, with the host. During a game, "This game" comes first: the host ends it
  for everyone, anyone leaves, each after a second tap that says what happens
  (development/plans/end-game.md), waited for at the button.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { themeShift } from '../../vendor/ewo/elements/theme-shift.js';
  import { setTheme, storedTheme, type ThemeChoice } from '../../vendor/ewo/elements/theme-toggle.js';
  import { effectiveTheme, onThemeChange } from '../../vendor/ewo/elements/base.js';
  import { i18n, setLanguage, systemLang, t, errorText, type LangChoice } from '../lib/i18n.svelte';
  import { ApiError } from '../lib/api';
  import type { Room } from '../lib/room.svelte';
  import { actAt } from '../lib/waits';
  import { toast } from '../../vendor/ewo/elements/toaster.js';

  let {
    open,
    onclose,
    room = null,
    onleave = () => {},
  }: { open: boolean; onclose: () => void; room?: Room | null; onleave?: () => void } = $props();

  const view = $derived(room?.view ?? null);
  const running = $derived(view?.phase === 'guess' || view?.phase === 'reveal');
  const isHost = $derived(!!room && view?.host === room.seat.player);
  const host = $derived(view?.players.find((p) => p.id === view.host) ?? null);
  /** Which second tap is showing. */
  let sure: 'end' | 'leave' | null = $state(null);
  $effect(() => {
    if (!open || !running) sure = null;
  });

  async function end(event: Event) {
    if (!room) return;
    try {
      if (await actAt(room, 'end', undefined, event)) onclose();
    } catch (error) {
      toast(errorText(error instanceof ApiError ? error.code : 'other'), { tone: 'bad' });
    }
  }

  async function leave(event: Event) {
    if (!room) return;
    // Out either way: a seat the server doesn't hear about drops out on its own.
    await actAt(room, 'leave', undefined, event).catch(() => {});
    onclose();
    onleave();
  }

  let theme: ThemeChoice = $state(storedTheme());

  // The rows stay until the sheet's `close` event, after its exit animation: dropped as closing
  // starts, the sheet slid out as a header on its own.
  let shown = $state(false);
  $effect(() => {
    if (open) shown = true;
  });

  function closed() {
    shown = false;
    onclose();
  }

  // Another tab, or the system's own switch while on System: the row shows what's stored.
  onMount(() => onThemeChange(() => (theme = storedTheme())));

  /**
   * The picked control updates at once; the page changes under themeShift's veil when it really
   * changes, and at once when it doesn't (System while the system already shows that language).
   */
  function pickLanguage(next: LangChoice) {
    if (next === i18n.choice) return;
    const shows = next === 'system' ? systemLang() : next;
    if (shows === i18n.lang) setLanguage(next);
    else themeShift(() => setLanguage(next));
  }

  function pickTheme(next: ThemeChoice) {
    if (next === theme) return;
    theme = next;
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const shows = next === 'system' ? (prefersDark ? 'dark' : 'light') : next;
    if (shows === effectiveTheme()) setTheme(next);
    else themeShift(() => setTheme(next));
  }
</script>

<ewo-sheet {open} label={t('settings')} oncancel={onclose} onclose={closed}>
  <span slot="heading">{t('settings')}</span>
  {#if open || shown}
    {#if running}
      <section class="this-game">
        <h3 class="label">{t('thisGame')}</h3>
        {#if sure === 'end'}
          <p class="sure">{t('endSure')}</p>
          <div class="row">
            <button class="btn primary" onclick={(e) => end(e)}>{t('endYes')}</button>
            <button class="btn secondary" onclick={() => (sure = null)}>{t('keepPlaying')}</button>
          </div>
        {:else if sure === 'leave'}
          <p class="sure">{isHost ? t('leaveSureHost') : t('leaveSure')}</p>
          <div class="row">
            <button class="btn primary" onclick={(e) => leave(e)}>{t('leaveYes')}</button>
            <button class="btn secondary" onclick={() => (sure = null)}>{t('keepPlaying')}</button>
          </div>
        {:else}
          {#if isHost}
            <button class="btn secondary block" onclick={() => (sure = 'end')}>
              <svg class="stop" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" /></svg>
              {t('endGame')}
            </button>
          {/if}
          <button class="btn secondary block" onclick={() => (sure = 'leave')}>{t('leave')}</button>
          {#if !isHost && host}<p class="hint">{t('endHint', { name: host.name })}</p>{/if}
        {/if}
      </section>
    {/if}
    <section>
      <h3 class="label">{t('general')}</h3>
      <!-- Its words come from Folio and follow <html lang>, so every app says exactly the same. -->
      <ewo-settings-basics
        language={i18n.choice}
        {theme}
        onlanguage-change={(e) => pickLanguage(e.detail.value)}
        ontheme-change={(e) => pickTheme(e.detail.value)}
      ></ewo-settings-basics>
    </section>
  {/if}
</ewo-sheet>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 8px;
  }
  h3 {
    margin: 0;
  }
  .this-game {
    padding-bottom: 20px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--ewo-line);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .row .btn {
    padding: 0 12px;
    white-space: normal;
  }
  .sure {
    margin: 0;
    color: var(--ewo-fg);
    font-size: 15px;
    line-height: 1.45;
  }
  .hint {
    margin: 0;
    color: var(--ewo-fg-3);
    font-size: 13px;
    text-align: center;
  }
  .stop {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
</style>
