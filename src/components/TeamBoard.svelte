<script lang="ts">
  // The teams, best first: a bar each in the team's colour, its players, this round's points and
  // the total.
  import type { Player } from '../lib/api';
  import { t, type Key } from '../lib/i18n.svelte';
  import { formatPoints } from '../lib/price';
  import Avatar from './Avatar.svelte';

  let { totals, gains = null, players, big = false }: { totals: number[]; gains?: number[] | null; players: Player[]; big?: boolean } = $props();

  const max = $derived(Math.max(1, ...totals));
  const rows = $derived(
    totals
      .map((total, team) => ({ team, total, gain: gains?.[team] ?? null, members: players.filter((p) => p.team === team) }))
      .sort((a, b) => b.total - a.total || a.team - b.team),
  );
</script>

<ol class="teams" class:big>
  {#each rows as row, i (row.team)}
    <li class="team-{row.team}" style:--i={i}>
      <span class="head">
        <span class="dot" aria-hidden="true"></span>
        <span class="name">{t('teamName', { name: t(`team_${row.team}` as Key) })}</span>
        <span class="members" aria-hidden="true">
          {#each row.members as player (player.id)}<Avatar {player} size={big ? 30 : 20} />{/each}
        </span>
        {#if row.gain !== null}<span class="gain price">+{formatPoints(row.gain)}</span>{/if}
        <span class="total price">{formatPoints(row.total)}</span>
      </span>
      <span class="bar" aria-hidden="true"><span style:--w={row.total / max}></span></span>
    </li>
  {/each}
</ol>

<style>
  .teams {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--team);
  }
  .name {
    font-weight: 650;
    white-space: nowrap;
  }
  .members {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 2px;
    overflow: hidden;
  }
  .gain {
    color: var(--ewo-fg-3);
    font-size: 13px;
  }
  .total {
    min-width: 4ch;
    text-align: right;
    font-size: 17px;
  }
  .bar {
    height: 8px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--team);
    transform-origin: left;
    transform: scaleX(var(--w));
    animation: grow 0.7s var(--ewo-ease) both;
    animation-delay: calc(0.3s + var(--i) * 0.08s);
  }
  @keyframes grow {
    from {
      transform: scaleX(0);
    }
  }
  .big {
    gap: clamp(8px, 0.8vw, 16px);
  }
  .big .name {
    font-size: clamp(15px, 1.25vw, 26px);
  }
  .big .total {
    font-size: clamp(17px, 1.5vw, 30px);
  }
  .big .gain {
    font-size: clamp(13px, 1.1vw, 20px);
  }
  .big .bar {
    height: clamp(6px, 0.6vw, 12px);
  }
  .big .dot {
    width: clamp(10px, 0.9vw, 16px);
    height: clamp(10px, 0.9vw, 16px);
  }
</style>
