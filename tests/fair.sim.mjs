// The draws on their real source, node:crypto's randomInt: every order of four listings, and every
// listing's chance to come first from the demo list and from the collection. Stochastic, so local only
// (npm run test:sim, the workspace's CLAUDE.md): a fair source fails these 1-in-a-million bounds once
// in a million runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockSource, shuffle } from '../server/items/mock.mjs';
import { createCollectionSource } from '../server/items/collection.mjs';

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
const ITEMS = ['Toaster', 'Laptop', 'Tablet', 'Topfset'].flatMap((keyword, k) =>
  [0, 1, 2].map((i) => ({ id: `ebay:${keyword}${i}`, theme: k < 2 ? 'kitchen' : 'tech', keyword, title: `${keyword} ${i}`, price: 40, condition: 'Gebraucht', image: 'https://i.ebayimg.com/images/g/x/s-l500.webp', url: 'https://www.ebay.de/itm/1', sold: true, soldOn: null, collected: null })),
);

async function firstPicks(makeSource, request, rounds) {
  const count = new Map();
  for (let i = 0; i < rounds; i++) {
    const [item] = await makeSource().draw({ count: 1, ...request });
    count.set(item.id, (count.get(item.id) ?? 0) + 1);
  }
  return [...count.values()];
}

test('node:crypto: a million shuffles of four listings land on every order evenly', () => {
  const orders = new Map();
  for (let i = 0; i < 1_000_000; i++) {
    const key = shuffle(['a', 'b', 'c', 'd']).join('');
    orders.set(key, (orders.get(key) ?? 0) + 1);
  }
  const c = chi([...orders.values()]);
  console.log(`  orders: chi-square ${c.toFixed(1)} (bound ${bound(23).toFixed(1)})`);
  assert.equal(orders.size, 24);
  assert.ok(c < bound(23));
});

test('node:crypto: every listing comes first as often, from the demo list and the collection', async () => {
  const demo = await firstPicks(() => createMockSource(), { price: 'everyday', themes: ['tech'] }, 260_000);
  console.log(`  demo: chi-square ${chi(demo).toFixed(1)} (bound ${bound(12).toFixed(1)})`);
  assert.equal(demo.length, 13);
  assert.ok(chi(demo) < bound(12));

  const collected = await firstPicks(() => createCollectionSource({ items: ITEMS, images }), { price: 'everyday', themes: ['kitchen', 'tech'] }, 240_000);
  console.log(`  collection: chi-square ${chi(collected).toFixed(1)} (bound ${bound(11).toFixed(1)})`);
  assert.equal(collected.length, 12);
  assert.ok(chi(collected) < bound(11));
});
