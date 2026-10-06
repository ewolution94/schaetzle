<script lang="ts">
  // Every guess on one line around the real price. The scale is logarithmic, like the scoring:
  // double and half the price sit the same distance either side of it. Guesses more than 8× off
  // are pinned to the ends.
  import type { Player, Result } from '../lib/api';
  import { formatPrice } from '../lib/price';
  import Avatar from './Avatar.svelte';

  let { price, results, players }: { price: number; results: Result[]; players: Player[] } = $props();

  const LIMIT = 8;

  /** The scale's ends, rounded like a price tag would be: 63,03 → 63, 4,37 → 4,40. */
  const round = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

  const marks = $derived.by(() => {
    const guesses = results.filter((r) => r.guess !== null) as (Result & { guess: number })[];
    const ratios = guesses.map((r) => Math.min(LIMIT, Math.max(1 / LIMIT, r.guess / price)));
    const span = Math.max(1.6, ...ratios.map((x) => Math.max(x, 1 / x))) * 1.18;
    const pos = (ratio: number) => 50 + (Math.log(ratio) / Math.log(span)) * 50;

    // Lanes, so close guesses stack instead of covering each other.
    const lanes: number[] = [];
    const placed = guesses
      .map((r, i) => ({ r, x: pos(ratios[i]), player: players.find((p) => p.id === r.player) }))
      .filter((m) => m.player)
      .sort((a, b) => a.x - b.x)
      .map((m) => {
        let lane = lanes.findIndex((end) => m.x - end >= 9);
        if (lane === -1) lane = lanes.length < 3 ? lanes.length : lanes.indexOf(Math.min(...lanes));
        lanes[lane] = m.x;
        return { ...m, lane };
      });
    return { placed, lanes: Math.max(1, lanes.length), low: price / span, high: price * span, half: pos(0.5), double: pos(2) };
  });
</script>

<div class="line" style:--lanes={marks.lanes}>
  <div class="track">
    <span class="score-zone" style:left="{marks.half}%" style:right="{100 - marks.double}%"></span>
    <span class="truth"><span class="truth-label price">{formatPrice(price)}</span></span>
    {#each marks.placed as mark, i (mark.r.player)}
      <span class="mark" style:left="{mark.x}%" style:--lane={mark.lane} style:--i={i}>
        <Avatar player={mark.player!} size={28} />
      </span>
    {/each}
  </div>
  <div class="ends label">
    <span>{formatPrice(round(marks.low))}</span>
    <span>{formatPrice(round(marks.high))}</span>
  </div>
</div>

<style>
  .line {
    padding: 52px 14px 0;
  }
  .track {
    position: relative;
    height: calc(var(--lanes) * 32px + 14px);
    border-bottom: 2px solid var(--ewo-line-strong);
  }
  /* The band that scores anything at all (half to double the price). */
  .score-zone {
    position: absolute;
    bottom: -2px;
    height: 2px;
    background: var(--red);
    opacity: 0.35;
  }
  .truth {
    position: absolute;
    left: 50%;
    top: -12px;
    bottom: -8px;
    width: 2px;
    translate: -1px 0;
    background: var(--red);
    border-radius: 2px;
  }
  .truth-label {
    position: absolute;
    bottom: 100%;
    left: 50%;
    translate: -50% -4px;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--red);
    color: #ffffff;
    font-size: 13px;
    white-space: nowrap;
  }
  .mark {
    position: absolute;
    bottom: calc(var(--lane) * 32px + 8px);
    translate: -50% 0;
    animation: drop 0.5s var(--ewo-ease-spring) both;
    animation-delay: calc(0.25s + var(--i) * 0.07s);
  }
  .mark::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 1px;
    height: calc(var(--lane) * 32px + 8px);
    background: var(--ewo-line-strong);
  }
  @keyframes drop {
    from {
      opacity: 0;
      translate: -50% -14px;
    }
  }
  .ends {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
  }
</style>
