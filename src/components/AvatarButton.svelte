<!--
  Your avatar as a button: it opens a sheet of emoji (lib/avatars.ts), and a tap on one picks it and
  closes the sheet. The first choice is no emoji at all, your name's initial. On the start and join
  screens, beside the name, and on your own row in the lobby.
-->
<script lang="ts">
  import type { Player } from '../lib/api';
  import { AVATARS } from '../lib/avatars';
  import { t } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';

  let {
    player,
    size = 52,
    onpick,
  }: { player: Pick<Player, 'name' | 'color' | 'emoji'>; size?: number; onpick: (emoji: string | null) => void } = $props();

  let open = $state(false);
  let button: HTMLButtonElement | undefined = $state();

  const initial = $derived([...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(player.name.trim())][0]?.segment.toUpperCase() ?? '?');

  function close() {
    open = false;
    // Focus goes back where it came from.
    button?.focus();
  }

  function pick(emoji: string | null) {
    if (emoji !== player.emoji) onpick(emoji);
    close();
  }
</script>

<!-- type="button": on the start and join screens this sits inside the name's form. -->
<button
  type="button"
  class="trigger"
  bind:this={button}
  aria-label={t('pickAvatar')}
  aria-haspopup="dialog"
  onclick={() => (open = true)}
>
  <Avatar {player} {size} />
  <svg class="edit" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="8" />
    <path d="M4.9 11.1l.5-2.1 3.9-3.9 1.6 1.6-3.9 3.9z" />
  </svg>
</button>

<ewo-sheet {open} label={t('avatar')} oncancel={close} onclose={close}>
  <span slot="heading">{t('avatar')}</span>
  {#if open}
    <div class="groups {player.color ? `c-${player.color}` : ''}">
      <section>
        <h3 class="label">{t('avatarInitial')}</h3>
        <div class="grid">
          <button
            type="button"
            class="cell initial"
            class:on={!player.emoji}
            aria-pressed={!player.emoji}
            aria-label={t('avatarInitial')}
            onclick={() => pick(null)}>{initial}</button
          >
        </div>
      </section>
      {#each AVATARS as group (group.label)}
        <section>
          <h3 class="label">{t(group.label)}</h3>
          <div class="grid">
            {#each group.emoji as emoji (emoji)}
              <button type="button" class="cell" class:on={player.emoji === emoji} aria-pressed={player.emoji === emoji} onclick={() => pick(emoji)}
                >{emoji}</button
              >
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</ewo-sheet>

<style>
  .trigger {
    position: relative;
    flex: none;
    display: inline-grid;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    -webkit-tap-highlight-color: transparent;
    transition: scale var(--ewo-dur-1);
  }
  .trigger:active {
    scale: 0.94;
  }
  .trigger:focus-visible {
    outline: 2px solid var(--red-text);
    outline-offset: 2px;
  }
  /* The pencil says the avatar can be changed. */
  .edit {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: max(15px, 36%);
    height: max(15px, 36%);
  }
  .edit circle {
    fill: var(--otto-ink);
    stroke: var(--surface);
    stroke-width: 1.5;
  }
  .edit path {
    fill: #ffffff;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-bottom: 8px;
  }
  h3 {
    margin: 0 0 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
    gap: 4px;
  }
  .cell {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: 14px;
    background: none;
    font: 30px / 1 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--ewo-dur-1),
      scale var(--ewo-dur-1);
  }
  .cell.initial {
    font: 700 22px / 1 var(--ewo-sans);
    color: var(--ewo-fg);
  }
  @media (hover: hover) {
    .cell:hover {
      background: var(--surface-2);
    }
  }
  .cell:active {
    scale: 0.9;
  }
  .cell:focus-visible {
    outline: 2px solid var(--red-text);
    outline-offset: -2px;
  }
  /* The one you have, on your colour once you have one. */
  .cell.on,
  .cell.on:hover {
    background: var(--pc, var(--surface-2));
    box-shadow: inset 0 0 0 2px var(--ewo-fg);
  }
  .groups[class*='c-'] .cell.initial.on {
    color: var(--otto-ink);
  }
</style>
