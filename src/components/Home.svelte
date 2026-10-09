<script lang="ts">
  import { api, ApiError, CODE, type Seat } from '../lib/api';
  import { errorText, t } from '../lib/i18n.svelte';
  import { saveAvatar, savedAvatar, savedName } from '../lib/session';
  import { newKey, waitAt } from '../lib/waits';
  import AvatarButton from './AvatarButton.svelte';
  import PriceTag from './PriceTag.svelte';

  let {
    demo,
    oncreate,
    onjoin,
  }: { demo: boolean; oncreate: (seat: Seat, name: string, signal: AbortSignal) => Promise<void>; onjoin: (code: string) => void } = $props();

  let name = $state(savedName());
  let avatar = $state(savedAvatar());
  let code = $state('');
  /** The same for every try of one "New game", so a retry after a timeout gets the same room. */
  let key = newKey();
  let error = $state('');

  const validCode = $derived(CODE.test(code));

  /** Waited for at the button (lib/waits.ts) until the lobby's first view is here. */
  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = errorText('name');
      return;
    }
    error = '';
    try {
      // The first tag this device plays under is kept, so the next game starts with it too.
      saveAvatar(avatar);
      await waitAt(event, async (signal) => oncreate(await api.create(name.trim(), avatar, key, signal), name.trim(), signal), t('wait_create'));
      key = newKey();
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
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
    <div class="you">
      <AvatarButton
        player={{ name, avatar }}
        onpick={(next) => {
          avatar = next;
          saveAvatar(next);
        }}
      />
      <input
        id="name"
        class="input"
        bind:value={name}
        maxlength="24"
        autocomplete="nickname"
        enterkeyhint="go"
        placeholder={t('namePlaceholder')}
      />
    </div>
    <button class="btn primary block">{t('newGame')}</button>
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
  .row,
  .you {
    display: flex;
    gap: 10px;
  }
  .you {
    align-items: center;
  }
  .you .input {
    flex: 1;
    min-width: 0;
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
