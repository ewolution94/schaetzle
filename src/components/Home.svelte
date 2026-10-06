<script lang="ts">
  import { api, ApiError, CODE, type Seat } from '../lib/api';
  import { errorText, t } from '../lib/i18n.svelte';
  import { savedName } from '../lib/session';
  import PriceTag from './PriceTag.svelte';

  let {
    demo,
    oncreate,
    onjoin,
  }: { demo: boolean; oncreate: (seat: Seat, name: string) => void; onjoin: (code: string) => void } = $props();

  let name = $state(savedName());
  let code = $state('');
  let busy = $state(false);
  let error = $state('');

  const validCode = $derived(CODE.test(code));

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      error = errorText('name');
      return;
    }
    busy = true;
    error = '';
    try {
      oncreate(await api.create(name.trim()), name.trim());
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    } finally {
      busy = false;
    }
  }

  function join(event: SubmitEvent) {
    event.preventDefault();
    if (validCode) onjoin(code);
  }

  /** Only the letters a code can have, upper-cased as you type. */
  function typeCode(event: Event & { currentTarget: HTMLInputElement }) {
    code = event.currentTarget.value.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXZ]/g, '').slice(0, 4);
    event.currentTarget.value = code;
  }
</script>

<section class="home">
  <div class="hero" aria-hidden="true">
    <PriceTag size="xl">?,??€</PriceTag>
  </div>

  <form class="create" onsubmit={create}>
    <label class="label" for="name">{t('yourName')}</label>
    <input
      id="name"
      class="input"
      bind:value={name}
      maxlength="24"
      autocomplete="nickname"
      enterkeyhint="go"
      placeholder={t('namePlaceholder')}
    />
    <button class="btn primary block" disabled={busy}>{t('newGame')}</button>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>

  <div class="or"><span>{t('or')}</span></div>

  <form class="join" onsubmit={join}>
    <label class="label" for="code">{t('code')}</label>
    <div class="row">
      <input
        id="code"
        class="input code"
        value={code}
        oninput={typeCode}
        maxlength="4"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        enterkeyhint="go"
        placeholder={t('codePlaceholder')}
      />
      <button class="btn secondary" disabled={!validCode}>{t('join')}</button>
    </div>
  </form>

  {#if demo}
    <p class="demo label">{t('demoNote')}</p>
  {/if}
</section>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 420px;
    margin: 0 auto;
    padding-top: clamp(16px, 6vh, 64px);
  }
  .hero {
    display: flex;
    justify-content: center;
    padding: 12px 0 28px;
  }
  .hero :global(.tag) {
    rotate: -7deg;
    animation: hang 1.1s var(--ewo-spring) both;
    transform-origin: 8% 50%;
  }
  @keyframes hang {
    from {
      rotate: -24deg;
      translate: 0 -12px;
      opacity: 0;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  .code {
    flex: 1;
    min-width: 0;
    font: 600 20px/1 var(--ewo-mono);
    letter-spacing: 0.35em;
    text-transform: uppercase;
  }
  .code::placeholder {
    letter-spacing: 0.35em;
  }

  .or {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--ewo-fg-3);
    font: 500 13px/1 var(--ewo-sans);
  }
  .or::before,
  .or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--ewo-line);
  }

  .demo {
    text-align: center;
    margin: 8px 0 0;
  }
</style>
