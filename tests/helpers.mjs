// Shared by the game tests: a fake clock, a seeded random, and rooms set up the way pages use them.

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
  const source = options.source ?? createMockSource({ random: seeded(7) });
  const games = createGames({ source, clock });
  return { clock, games };
}

export function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
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
