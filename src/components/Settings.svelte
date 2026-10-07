<!--
  Settings, the family's way (plans/settings-alignment.md): Folio's ewo-sheet, opened from the
  bar's ewo-settings-button, with General first (ewo-settings-basics: Language and Theme). The
  game's own settings live in the lobby, with the host, so General is all there is here.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { themeShift } from '../../vendor/ewo/elements/theme-shift.js';
  import { setTheme, storedTheme, type ThemeChoice } from '../../vendor/ewo/elements/theme-toggle.js';
  import { effectiveTheme, onThemeChange } from '../../vendor/ewo/elements/base.js';
  import { i18n, setLanguage, systemLang, t, type LangChoice } from '../lib/i18n.svelte';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let theme: ThemeChoice = $state(storedTheme());

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

<ewo-sheet {open} label={t('settings')} oncancel={onclose} onclose={onclose}>
  <span slot="heading">{t('settings')}</span>
  {#if open}
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
</style>
