<script lang="ts">
  import type { Player } from '../lib/api';

  let { player, size = 32, check = false, dim = false }: { player: Pick<Player, 'name' | 'color'>; size?: number; check?: boolean; dim?: boolean } = $props();

  const initial = $derived([...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(player.name)][0]?.segment.toUpperCase() ?? '?');
</script>

<span class="avatar c-{player.color}" class:dim style:--size="{size}px" aria-hidden="true">
  {initial}
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
    border-radius: 50%;
    background: var(--pc);
    color: var(--otto-ink);
    font: 700 calc(var(--size) * 0.44) / 1 var(--ewo-sans);
    transition: opacity var(--ewo-dur-2);
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
