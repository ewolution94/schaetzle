// Shared by the game tests: a fake clock, a seeded randomInt, and rooms set up the way pages use them.

import { createGames } from '../server/game.mjs';
import { createMockSource } from '../server/items/mock.mjs';

/** A clock that only moves when the test says so. */
export function fakeClock(start = 1_000_000) {
  let t = start;
  let timers = [];
  return {
    now: () => t,
    setTimeout(fn, ms) {
      const handle = { at: t + ms, fn };
      timers.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      timers = timers.filter((h) => h !== handle);
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((h) => h.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((h) => h !== due);
        t = due.at;
        due.fn();
      }
      t = end;
    },
  };
}

export function setup(options = {}) {
  const clock = fakeClock();
  const source = options.source ?? createMockSource({ randomInt: seeded(7) });
  const games = createGames({ source, clock });
  return { clock, games };
}

/** mulberry32's 32-bit words: the same sequence for the same seed. */
export function words(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/**
 * An integer in 0..n-1 from 32-bit words, exactly uniform: a word at or past the last full multiple
 * of n is drawn again, the way node:crypto's randomInt does it (learnings/randomness.md in the
 * workspace). Scaling or taking the word modulo n would favour the low numbers.
 * @param {number} n  @param {() => number} word
 */
export function fairInt(n, word) {
  if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new RangeError('fairInt needs an integer 1 ≤ n ≤ 2^32');
  const limit = Math.floor(0x100000000 / n) * n;
  let w = word() >>> 0;
  while (w >= limit) w = word() >>> 0;
  return w % n;
}

/** A seeded randomInt(n) → 0..n-1, for the item sources in place of node:crypto's. */
export function seeded(seed = 1) {
  const word = words(seed);
  return (n) => fairInt(n, word);
}

/** Subscribes like a page would, and keeps the latest view. */
export function watch(games, code, player) {
  const seen = { view: null, count: 0 };
  const off = games.subscribe(code, player, (json) => {
    seen.view = JSON.parse(json);
    seen.count++;
  });
  return Object.assign(seen, { off });
}

export async function threePlayers(settings = {}) {
  const env = setup();
  const { games } = env;
  const host = games.create({ name: 'Anna' });
  const ben = games.join(host.code, { name: 'Ben' });
  const cem = games.join(host.code, { name: 'Cem' });
  const pages = [host, ben, cem].map((p) => watch(games, host.code, p.player));
  if (Object.keys(settings).length) await games.act(host.code, host.token, 'settings', settings);
  return { ...env, host, ben, cem, pages };
}
