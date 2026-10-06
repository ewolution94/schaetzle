<script lang="ts">
  // The red price tag, OTTO's sale red: the game's mark on the start page and the reveal itself.
  // A pointed end with a hole (for the string) and a rounded body; the point scales with the tag's
  // height, so it stays the same shape at any size.
  import type { Snippet } from 'svelte';

  let { caption = '', size = 'md', children }: { caption?: string; size?: 'md' | 'lg' | 'xl'; children: Snippet } = $props();
</script>

<span class="tag {size}">
  <svg class="point" viewBox="0 0 20 40" aria-hidden="true">
    <!-- The hole is cut out (evenodd), so whatever the tag hangs on shows through it. -->
    <path fill-rule="evenodd" d="M20 0H13.2a4 4 0 0 0-3.3 1.7L1.2 17.7a4 4 0 0 0 0 4.6l8.7 16a4 4 0 0 0 3.3 1.7H20ZM16.2 20a3.2 3.2 0 1 0-6.4 0a3.2 3.2 0 1 0 6.4 0Z" />
  </svg>
  <span class="body">
    {#if caption}<span class="caption">{caption}</span>{/if}
    <span class="value price">{@render children()}</span>
  </span>
</span>

<style>
  /* A fixed height per size, so the point (half as wide as the tag is tall) always fits. */
  .tag {
    --h: 52px;
    display: inline-flex;
    align-items: stretch;
    height: var(--h);
    color: #ffffff;
    white-space: nowrap;
    filter: drop-shadow(0 10px 18px rgb(150 0 20 / calc(0.18 + 0.1 * (1 - var(--ewo-light)))));
  }
  .lg {
    --h: 78px;
  }
  .xl {
    --h: clamp(88px, 24vw, 120px);
  }
  .point {
    flex: none;
    width: calc(var(--h) / 2);
    height: var(--h);
    margin-right: -1px;
    overflow: visible;
  }
  path {
    fill: var(--red);
  }
  .body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding: 0 18px 0 4px;
    background: var(--red);
    border-radius: 0 12px 12px 0;
  }
  .caption {
    font: 600 var(--ewo-text-2xs) / 1 var(--ewo-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .value {
    font-size: 28px;
    line-height: 1;
  }
  .lg .value {
    font-size: 44px;
  }
  .lg .body {
    padding: 0 22px 0 6px;
    border-radius: 0 16px 16px 0;
  }
  .xl .value {
    font-size: calc(var(--h) * 0.56);
  }
  .xl .body {
    padding: 0 calc(var(--h) * 0.24) 0 8px;
    border-radius: 0 20px 20px 0;
  }
</style>
