<script lang="ts">
  import type { Player } from '../lib/api';

  // A player's price tag: Folio's `tag` emblem (development/plans/emblems.md) in the colour the room
  // gave them, with the pattern and figure they chose. Without a colour (choosing one before joining,
  // when the server hasn't handed one out yet) it's a plain grey tag.
  let {
    player,
    size = 32,
    check = false,
    dim = false,
  }: { player: Pick<Player, 'name' | 'color' | 'avatar'>; size?: number; check?: boolean; dim?: boolean } = $props();
</script>

<span class="avatar {player.color ? `c-${player.color}` : 'plain'}" class:dim style:--size="{size}px" aria-hidden="true">
  <!-- Drawn a tenth larger than the box: tilted, a tag looks smaller than a circle the same size. -->
  <ewo-emblem theme="tag" value={player.avatar} initial={player.name} size={Math.round(size * 1.1)}></ewo-emblem>
  {#if check}
    <svg class="check" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" /><path d="M4.6 8.3l2.2 2.2 4.6-4.8" /></svg>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    /* The tag in the player's colour; its hole shows the card it sits on. */
    --ewo-emblem-1: var(--pc);
    --ewo-emblem-paper: var(--surface);
    transition: opacity var(--ewo-dur-2);
  }
  .plain {
    --ewo-emblem-1: #d8d6d0;
  }
  ewo-emblem {
    margin: calc(var(--size) * -0.05);
  }
  .dim {
    opacity: 0.4;
  }
  .check {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: max(14px, calc(var(--size) * 0.42));
    height: max(14px, calc(var(--size) * 0.42));
    animation: pop 0.35s var(--ewo-ease-spring) both;
  }
  .check circle {
    fill: var(--otto-ink);
    stroke: var(--surface);
    stroke-width: 1.5;
  }
  .check path {
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }
</style>
