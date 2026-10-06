<script lang="ts">
  import { onMount } from 'svelte';
  import { startField } from '../lib/field';

  let canvas: HTMLCanvasElement;
  onMount(() => startField(canvas));
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    /* Read back by field.ts as the dots' colour. */
    color: var(--ewo-fg);
  }
</style>
