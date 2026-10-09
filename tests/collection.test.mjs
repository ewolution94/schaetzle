import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readSearchPage } from '../tools/ebay-page.mjs';
import { bookmarklet, collectorCode } from '../tools/collector.mjs';
import { addFile, formatCollection } from '../tools/collect.mjs';
import { createCollectionSource } from '../server/items/collection.mjs';
import { createMockSource } from '../server/items/mock.mjs';
import { withFallback } from '../server/items/index.mjs';
import { seeded, setup } from './helpers.mjs';

// A real ebay.de results page trimmed to eight cards, as eBay sends it and as a browser serialises
// it (what the bookmarklet reads). learnings/scraping-and-data.md.
const RAW = readFileSync(new URL('./fixtures/ebay-search.html', import.meta.url), 'utf8');
const BROWSER = readFileSync(new URL('./fixtures/ebay-search.browser.html', import.meta.url), 'utf8');

function registry() {
  const registered = [];
  return {
    registered,
    register(candidates) {
      registered.push(candidates);
      return `/img/${registered.length}`;
    },
  };
}

test('a results page reads the same as eBay sends it and as a browser holds it', () => {
  const items = readSearchPage(RAW);
  assert.deepEqual(readSearchPage(BROWSER), items);
  // Six listings: eBay's two adverts have no item id.
  assert.equal(items.length, 6);
  assert.deepEqual(items[0], {
    id: '146579186800',
    title: items[0].title,
    price: 289.99,
    condition: 'Neu',
    image: items[0].image,
    url: 'https://www.ebay.de/itm/146579186800',
    soldOn: null,
  });
  assert.match(items[0].title, /^Kaffeevollautomat/);
  for (const item of items) {
    assert.ok(item.title.length > 10, item.title);
    assert.ok(item.price > 0);
    assert.match(item.image, /^https:\/\/i\.ebayimg\.com\/images\/g\/.+\/s-l\d+\.webp$/);
  }
  assert.deepEqual(
    items.map((item) => item.condition),
    ['Neu', 'Zertifiziert - Refurbished', 'Neu', 'Gebraucht', 'Nur Ersatzteile', 'Gebraucht'],
  );
});

test('a sold date is read, and a price range is no price', () => {
  const sold = BROWSER.replace('EUR 289,99', 'EUR 289,99</span><span class="s-card__caption">Verkauft&nbsp; 5. Okt 2026');
  assert.equal(readSearchPage(sold)[0].soldOn, '2026-10-05');
  const am = RAW.replace('EUR 80,00', 'EUR 80,00</span><span>Verkauft am 30. Mär. 2026');
  assert.equal(readSearchPage(am)[1].soldOn, '2026-03-30');
  const range = RAW.replace('EUR 289,99', 'EUR 249,99 bis EUR 289,99');
  assert.equal(readSearchPage(range)[0].price, null);
});

/** Runs the bookmarklet on a page, with its prompt answered, and returns the file it downloads. */
function runCollector(html, { url, answer }) {
  let file = null;
  const alerts = [];
  const context = {
    location: new URL(url),
    URLSearchParams,
    document: {
      documentElement: { outerHTML: html },
      body: { append() {} },
      createElement: () => ({ click() {}, remove() {} }),
    },
    prompt: (message, guess) => {
      context.asked = { message, guess };
      return answer;
    },
    alert: (message) => alerts.push(message),
    Blob: class {
      constructor(parts) {
        file = JSON.parse(parts.join(''));
      }
    },
    URL: { createObjectURL: () => 'blob:x' },
  };
  vm.runInNewContext(collectorCode(), context);
  return { file, alerts, asked: context.asked };
}

test('the bookmarklet turns the open page into a collector file', () => {
  assert.match(bookmarklet(), /^javascript:\(\(\)/);
  // The bookmark compiles and is the same program as the readable code.
  assert.doesNotThrow(() => new vm.Script(decodeURIComponent(bookmarklet().slice('javascript:'.length))));
  assert.ok(bookmarklet().length < collectorCode().length * 1.6, 'comments and indentation are gone');
  const { file, asked } = runCollector(BROWSER, {
    url: 'https://www.ebay.de/sch/i.html?_nkw=Kaffeevollautomat&LH_Sold=1&LH_Complete=1',
    answer: 'kitchen',
  });
  // It guesses the category from the search, and says how many it found.
  assert.equal(asked.guess, 'kitchen');
  assert.match(asked.message, /6 listings for "Kaffeevollautomat", sold\./);
  assert.equal(file.schaetzle, 1);
  assert.equal(file.theme, 'kitchen');
  assert.equal(file.keyword, 'Kaffeevollautomat');
  assert.equal(file.sold, true);
  assert.equal(file.items.length, 6);

  const unsold = runCollector(BROWSER, { url: 'https://www.ebay.de/sch/i.html?_nkw=Toaster', answer: 'kitchen' });
  assert.match(unsold.asked.message, /NOT sold/);
  assert.equal(runCollector(BROWSER, { url: 'https://www.ebay.de/sch/i.html?_nkw=Toaster', answer: null }).file, null);
  assert.match(runCollector(BROWSER, { url: 'https://www.ebay.de/sch/i.html?_nkw=x', answer: 'cars' }).alerts[0], /unknown category/);
  assert.match(runCollector(BROWSER, { url: 'https://www.ebay.de/itm/1', answer: 'kitchen' }).alerts[0], /search results page/);
});

test('a collector file joins the collection; what a game can’t play stays out', () => {
  const { file } = runCollector(BROWSER, { url: 'https://www.ebay.de/sch/i.html?_nkw=Kaffeevollautomat&LH_Sold=1', answer: 'kitchen' });
  file.items.push({ ...file.items[0], id: '999', title: 'Wehrmacht Kaffeemühle' });
  const first = addFile([], file);
  assert.equal(first.added, 5);
  assert.deepEqual(first.skipped, { 'spare parts': 1, 'blocked title': 1 });
  const item = first.collection.find((i) => i.id === 'ebay:146579186800');
  assert.deepEqual(Object.keys(item), ['id', 'theme', 'keyword', 'title', 'price', 'condition', 'image', 'url', 'sold', 'soldOn', 'collected']);
  assert.equal(item.theme, 'kitchen');
  assert.equal(item.sold, true);

  // The same file again adds nothing.
  const again = addFile(first.collection, file);
  assert.equal(again.added, 0);
  assert.equal(again.known, 5);
  assert.throws(() => addFile([], { items: [] }), /not a collector file/);
  // One listing per line.
  assert.equal(formatCollection(first.collection).split('\n').length, 5 + 3);
});

/** A collection of `n` listings per keyword. */
function collection(spec) {
  const items = [];
  for (const [theme, keyword, n, price = 40] of spec) {
    for (let i = 0; i < n; i++) {
      items.push({ id: `ebay:${keyword}${i}`, theme, keyword, title: `${keyword} ${i}`, price, condition: 'Gebraucht', image: 'https://i.ebayimg.com/images/g/x/s-l500.webp', url: 'https://www.ebay.de/itm/1', sold: true, soldOn: null, collected: null });
    }
  }
  return items;
}

test('a game mixes the keywords of the host’s categories, then takes others in the same range', async () => {
  const items = collection([
    ['kitchen', 'Toaster', 6],
    ['kitchen', 'Wasserkocher', 6],
    ['tech', 'Laptop', 6],
    ['garden', 'Rasenmäher', 6],
    ['garden', 'Kugelgrill', 4, 900],
  ]);
  const images = registry();
  const source = createCollectionSource({ items, images, random: seeded(2) });
  const ten = await source.draw({ count: 10, price: 'everyday', themes: ['kitchen', 'tech'], exclude: new Set() });
  assert.equal(ten.length, 10);
  assert.ok(ten.every((item) => item.theme !== 'garden'));
  assert.equal(new Set(ten.map((item) => item.title.split(' ')[0])).size, 3, 'all three keywords');
  assert.ok(ten.every((item) => item.images[0].startsWith('/img/') && item.art === null));
  assert.match(images.registered[0][0], /s-l960\.webp$/);

  // Short of kitchen and tech, it takes garden in the same range, never the 900 € grills.
  const more = await source.draw({ count: 20, price: 'everyday', themes: ['kitchen', 'tech'], exclude: new Set() });
  assert.ok(more.some((item) => item.theme === 'garden'));
  assert.ok(more.every((item) => item.price <= 500));
  await assert.rejects(source.draw({ count: 30, price: 'everyday', themes: ['tech'], exclude: new Set() }), { code: 'empty' });
});

test('a game the collection can’t fill plays the demo list, and says "demo"', async () => {
  const source = withFallback(createCollectionSource({ items: collection([['tech', 'Laptop', 3]]), images: registry() }), createMockSource({ random: seeded(4) }), () => {});
  const { games } = setup({ source });
  const { code, token } = games.create({ name: 'Anna' });
  games.join(code, { name: 'Ben' });
  assert.equal(games.view(code).demo, false);
  await games.act(code, token, 'start');
  assert.equal(games.view(code).phase, 'guess');
  assert.equal(games.view(code).demo, true);
});

test('a full game from the collection is not demo', async () => {
  const source = withFallback(createCollectionSource({ items: collection([['tech', 'Laptop', 10], ['tech', 'Tablet', 10]]), images: registry() }), createMockSource(), () => {});
  const { games } = setup({ source });
  const { code, token } = games.create({ name: 'Anna' });
  await games.act(code, token, 'settings', { themes: ['tech'] });
  await games.act(code, token, 'start');
  assert.equal(games.view(code).phase, 'guess');
  assert.equal(games.view(code).demo, false);
});
