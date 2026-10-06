<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n.svelte';

  let { code }: { code: string | null } = $props();

  let scrolled = $state(false);
  onMount(() => {
    const check = () => (scrolled = scrollY > 8);
    check();
    addEventListener('scroll', check, { passive: true });
    return () => removeEventListener('scroll', check);
  });
</script>

<header class="bar" class:scrolled>
  <a class="mark" href="/" aria-label="Schätzle">
    <img src="/icon.svg" alt="" width="28" height="28" />
    <span class="word">Schätzle</span>
  </a>
  <div class="end">
    {#if code}
      <span class="code" aria-label="{t('code')} {code}">{code}</span>
    {/if}
    <ewo-theme-toggle label-light={t('toLight')} label-dark={t('toDark')}></ewo-theme-toggle>
  </div>
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: var(--bar-h);
    padding: 0 var(--gutter);
    background: color-mix(in oklab, var(--ewo-bg) 92%, transparent);
    border-bottom: 1px solid transparent;
  }
  .bar.scrolled {
    border-bottom-color: var(--ewo-line-2);
  }

  .mark {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    white-space: nowrap;
  }
  img {
    display: block;
    border-radius: 8px;
  }
  .word {
    font: 800 19px/1 var(--ewo-sans);
    letter-spacing: -0.03em;
  }
  /* The mark wobbles once when you point at it. */
  @media (hover: hover) {
    .mark:hover img {
      animation: swing 0.7s var(--ewo-ease);
      transform-origin: 30% 20%;
    }
  }
  @keyframes swing {
    25% {
      rotate: -12deg;
    }
    55% {
      rotate: 8deg;
    }
    80% {
      rotate: -3deg;
    }
  }

  .end {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .code {
    padding: 5px 10px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-2);
    font: 600 13px/1 var(--ewo-mono);
    letter-spacing: 0.18em;
  }
</style>
