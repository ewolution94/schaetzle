<script lang="ts">
  // An item's first photo, or a demo item's emoji on its tint: for the sort board, the item to
  // compare with, and the recap.
  import type { Art } from '../lib/api';

  let { image = null, art = null }: { image?: string | null; art?: Art | null } = $props();
</script>

<span class="thumb">
  {#if image}
    <img src={image} alt="" decoding="async" draggable="false" />
  {:else if art}
    <span class="art t-{art.tint}"><span class="emoji">{art.emoji}</span></span>
  {/if}
</span>

<style>
  .thumb {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--plate);
    container-type: inline-size;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }
  .art {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    background:
      radial-gradient(circle at 50% 42%, rgb(255 255 255 / calc(0.45 * var(--ewo-light))), transparent 62%),
      var(--tint);
  }
  .emoji {
    font-size: 52cqi;
    line-height: 1;
    filter: drop-shadow(0 8px 10px rgb(0 0 0 / 0.16));
  }
</style>
