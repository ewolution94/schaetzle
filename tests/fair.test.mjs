// Fair draws: which listings a game gets, and in what order, come from a whole randomInt(n),
// node:crypto's in production (exactly uniform, by rejection), a seeded one here. The statistics on
// the real source are in fair.sim.mjs (npm run test:sim); learnings/randomness.md in the workspace
// has the why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockSource, shuffle } from '../server/items/mock.mjs';
import { createCollectionSource } from '../server/items/collection.mjs';
import { fairInt, seeded } from './helpers.mjs';

/** The chi-square value df degrees of freedom stay under with probability 1 - 1e-6 (Wilson–Hilferty). */
function bound(df) {
  const z = 4.753;
  return df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
}
const chi = (count) => {
  const total = count.reduce((a, b) => a + b, 0);
  const e = total / count.length;
  return count.reduce((s, c) => s + (c - e) ** 2 / e, 0);
};

const images = { register: () => '/img/1' };
/** Four searches of three listings each, all in the everyday range. */
const ITEMS = ['Toaster', 'Laptop', 'Tablet', 'Topfset'].flatMap((keyword, k) =>
  [0, 1, 2].map((i) => ({ id: `ebay:${keyword}${i}`, theme: k < 2 ? 'kitchen' : 'tech', keyword, title: `${keyword} ${i}`, price: 40, condition: 'Gebraucht', image: 'https://i.ebayimg.com/images/g/x/s-l500.webp', url: 'https://www.ebay.de/itm/1', sold: true, soldOn: null, collected: null })),
);

/** How often each listing comes first in `rounds` one-item draws, by id. */
async function firstPicks(makeSource, request, rounds) {
  const count = new Map();
  for (let i = 0; i < rounds; i++) {
    const [item] = await makeSource().draw({ count: 1, ...request });
    count.set(item.id, (count.get(item.id) ?? 0) + 1);
  }
  return count;
}

test('the seeded source owns the same count of words per number and draws again past the limit', () => {
  for (const n of [1, 2, 3, 5, 7, 12, 13, 24]) {
    const limit = Math.floor(2 ** 32 / n) * n;
    assert.equal(limit % n, 0);
    assert.ok(2 ** 32 - limit < n, 'fewer than n words are ever redrawn');
    const seq = (...ws) => () => ws.shift();
    assert.equal(fairInt(n, seq(limit - 1)), (limit - 1) % n, 'the last word kept');
    if (limit < 2 ** 32) assert.equal(fairInt(n, seq(limit, 2 ** 32 - 1, 4)), 4 % n, 'a word past the limit is drawn again');
  }
  assert.throws(() => fairInt(0, () => 0), RangeError);
  assert.throws(() => fairInt(2.5, () => 0), RangeError);
});

test('shuffle is Fisher–Yates on whole numbers: one randomInt per listing, from the top down', () => {
  const asked = [];
  const top = (n) => (asked.push(n), n - 1);
  assert.deepEqual(shuffle([0, 1, 2, 3, 4], top), [0, 1, 2, 3, 4], 'the top of every range keeps the order');
  assert.deepEqual(asked, [5, 4, 3, 2]);
  assert.deepEqual(shuffle([0, 1, 2, 3, 4], () => 0), [1, 2, 3, 4, 0], 'the bottom of every range');
});

test('every order of four listings is equally likely (chi-square on a seeded source)', () => {
  const randomInt = seeded(11);
  const orders = new Map();
  for (let i = 0; i < 48_000; i++) {
    const key = shuffle(['a', 'b', 'c', 'd'], randomInt).join('');
    orders.set(key, (orders.get(key) ?? 0) + 1);
  }
  assert.equal(orders.size, 24);
  const c = chi([...orders.values()]);
  assert.ok(c < bound(23), `chi-square ${c.toFixed(1)} with 23 degrees of freedom`);
});

test('every listing in the range is as likely to come first, demo or collection (seeded)', async () => {
  const randomInt = seeded(5);
  const demo = await firstPicks(() => createMockSource({ randomInt }), { price: 'everyday', themes: ['tech'] }, 13_000);
  assert.equal(demo.size, 13, 'the thirteen everyday tech listings');
  assert.ok(chi([...demo.values()]) < bound(12), `demo: chi-square ${chi([...demo.values()]).toFixed(1)}`);

  // A fresh source each time, so the rotation doesn't favour the ones not shown yet.
  const collected = await firstPicks(() => createCollectionSource({ items: ITEMS, images, randomInt }), { price: 'everyday', themes: ['kitchen', 'tech'] }, 12_000);
  assert.equal(collected.size, 12);
  assert.ok(chi([...collected.values()]) < bound(11), `collection: chi-square ${chi([...collected.values()]).toFixed(1)}`);
});

test('without a source of their own, the draws come from node:crypto, never Math.random', async () => {
  const real = Math.random;
  Math.random = () => {
    throw new Error('an outcome came from Math.random');
  };
  try {
    assert.equal((await createMockSource().draw({ count: 10, price: 'all', themes: ['home'] })).length, 10);
    assert.equal((await createCollectionSource({ items: ITEMS, images }).draw({ count: 6, price: 'everyday', themes: ['tech'] })).length, 6);
    assert.equal(shuffle([1, 2, 3]).length, 3);
  } finally {
    Math.random = real;
  }
});
