<!--
  Your price tag as a button: it opens Folio's emblem maker (development/plans/emblems.md) in a sheet,
  with arrows for the colour, the pattern and the figure, and a dice. Every change counts at once. On
  the start and join screens, beside the name, and on your own row in the lobby.
-->
<script lang="ts">
  import type { Avatar as Value, Player } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';

  let {
    player,
    size = 52,
    onpick,
  }: { player: Pick<Player, 'name' | 'avatar'>; size?: number; onpick: (avatar: Value) => void } = $props();

  let open = $state(false);
  // The maker stays until the sheet's `close` event, after its exit animation: dropped as closing
  // starts, the sheet slid out as a header on its own.
  let shown = $state(false);
  $effect(() => {
    if (open) shown = true;
  });
  let button: HTMLButtonElement | undefined = $state();

  function close() {
    open = false;
    // Focus goes back where it came from.
    button?.focus();
  }

  function closed() {
    shown = false;
    if (!open) button?.focus();
  }

  function change(value: number[]) {
    if (value.length === 3 && value.join() !== player.avatar.join()) onpick([value[0], value[1], value[2]]);
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

<ewo-sheet {open} label={t('avatar')} oncancel={close} onclose={closed}>
  <span slot="heading">{t('avatar')}</span>
  {#if open || shown}
    <div class="body">
      <ewo-emblem-maker theme="tag" value={player.avatar} initial={player.name} onchange={(e) => change(e.detail.value)}></ewo-emblem-maker>
      <button class="btn primary block" type="button" onclick={close}>{t('avatarDone')}</button>
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
  /* For the mouse; a finger gets Folio's pressFeedback (main.ts). */
  @media (hover: hover) and (pointer: fine) {
    .trigger:active {
      scale: 0.94;
    }
  }
  .trigger:focus-visible {
    outline: 2px solid var(--red-text);
    outline-offset: 2px;
  }
  /* The pencil says the tag can be changed. */
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

  /* The big tag's hole shows the stage. */
  .body {
    display: grid;
    gap: 18px;
    padding-bottom: 8px;
    --ewo-emblem-paper: var(--surface-2);
  }
  ewo-emblem-maker {
    --ewo-emblem-maker-size: 200px;
  }
  ewo-emblem-maker::part(stage) {
    background: var(--surface-2);
  }
  ewo-emblem-maker::part(tag) {
    background: var(--red);
    color: #ffffff;
  }
</style>
