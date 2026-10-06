<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError, type Phase, type Seat } from '../lib/api';
  import { errorText, t } from '../lib/i18n.svelte';
  import { savedName } from '../lib/session';

  let { code, onjoin, onback }: { code: string; onjoin: (seat: Seat, name: string) => void; onback: () => void } = $props();

  let info: { phase: Phase; players: number; full: boolean } | null = $state(null);
  let missing = $state(false);
  let name = $state(savedName());
  let busy = $state(false);
  let error = $state('');
  let input: HTMLInputElement | undefined = $state();

  onMount(() => {
    api.info(code).then(
      (i) => {
        info = i;
        if (!name) input?.focus();
      },
      (e) => {
        if (e instanceof ApiError && e.code === 'no-room') missing = true;
        else error = errorText(e instanceof ApiError ? e.code : 'other');
      },
    );
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      error = errorText('name');
      return;
    }
    busy = true;
    error = '';
    try {
      onjoin(await api.join(code, name.trim()), name.trim());
    } catch (e) {
      const reason = e instanceof ApiError ? e.code : 'other';
      if (reason === 'no-room') missing = true;
      error = errorText(reason);
    } finally {
      busy = false;
    }
  }
</script>

<section class="join">
  {#if missing}
    <h1>{t('error:no-room')}</h1>
    <button class="btn secondary" onclick={onback}>{t('home')}</button>
  {:else}
    <p class="label">{t('joinGame', { code })}</p>
    <h1 class="code">{code}</h1>
    {#if info}
      <p class="who">
        {info.players === 1 ? t('joinWhoOne') : t('joinWho', { n: info.players })}
        {#if info.phase !== 'lobby'}<br />{t('joinRunning')}{/if}
      </p>
    {/if}
    <form onsubmit={submit}>
      <label class="label" for="join-name">{t('yourName')}</label>
      <input
        id="join-name"
        class="input"
        bind:this={input}
        bind:value={name}
        maxlength="24"
        autocomplete="nickname"
        enterkeyhint="go"
        placeholder={t('namePlaceholder')}
      />
      <button class="btn primary block" disabled={busy || info?.full}>{t('join')}</button>
      {#if info?.full}<p class="error">{t('error:room-full')}</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
    <button class="btn quiet" onclick={onback}>{t('back')}</button>
  {/if}
</section>

<style>
  .join {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    max-width: 420px;
    margin: 0 auto;
    padding-top: clamp(24px, 8vh, 80px);
    text-align: center;
  }
  h1 {
    margin: 0;
    font: 700 22px/1.3 var(--ewo-sans);
  }
  .code {
    font: 700 clamp(48px, 16vw, 72px) / 1 var(--ewo-mono);
    letter-spacing: 0.2em;
    margin-right: -0.2em;
  }
  .who {
    margin: 0 0 8px;
    color: var(--ewo-fg-2);
    line-height: 1.5;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
  }
  .quiet {
    align-self: center;
  }
</style>
