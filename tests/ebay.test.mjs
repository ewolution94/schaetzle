import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEbaySource, toItem, upsized, SourceError } from '../server/items/ebay.mjs';
import { createSource } from '../server/items/index.mjs';
import { blocked } from '../server/items/themes.mjs';

// Shaped like eBay's documented search response (Browse API → item_summary/search). Replace with a
// captured real response once the keyset exists (learnings/scraping-and-data.md).
function summary(overrides = {}) {
  return {
    itemId: 'v1|1234567890|0',
    title: 'Weber Kugelgrill Master-Touch 57 cm schwarz',
    price: { value: '169.00', currency: 'EUR' },
    condition: 'Gebraucht',
    conditionId: '3000',
    image: { imageUrl: 'https://i.ebayimg.com/images/g/abc/s-l225.jpg' },
    additionalImages: [{ imageUrl: 'https://i.ebayimg.com/images/g/def/s-l225.jpg' }],
    itemWebUrl: 'https://www.ebay.de/itm/1234567890',
    buyingOptions: ['FIXED_PRICE'],
    ...overrides,
  };
}

const RANGE = [5, 500];

test('a listing becomes a game item', () => {
  const item = toItem(summary(), 'garden', RANGE);
  assert.deepEqual(item, {
    id: 'ebay:v1|1234567890|0',
    theme: 'garden',
    title: 'Weber Kugelgrill Master-Touch 57 cm schwarz',
    condition: 'Gebraucht',
    images: ['https://i.ebayimg.com/images/g/abc/s-l225.jpg', 'https://i.ebayimg.com/images/g/def/s-l225.jpg'],
    art: null,
    price: 169,
    url: 'https://www.ebay.de/itm/1234567890',
  });
});

test('listings a game cannot use are dropped', () => {
  assert.equal(toItem(summary({ image: undefined, additionalImages: [] }), 'garden', RANGE), null);
  assert.equal(toItem(summary({ price: { value: '169.00', currency: 'USD' } }), 'garden', RANGE), null);
  assert.equal(toItem(summary({ price: { value: '600.00', currency: 'EUR' } }), 'garden', RANGE), null);
  assert.equal(toItem(summary({ title: 'Wehrmacht Stahlhelm Original' }), 'collect', RANGE), null);
  assert.equal(toItem(summary({ image: { imageUrl: 'https://evil.example/x.jpg' }, additionalImages: [] }), 'garden', RANGE), null);
  assert.equal(toItem(summary({ itemWebUrl: 'https://evil.example/' }), 'garden', RANGE).url, null);
});

test('the blocklist matches whole words only', () => {
  assert.equal(blocked('Sexy Dessous schwarz'), true);
  assert.equal(blocked('SS Uniform'), true);
  assert.equal(blocked('Österreich Briefmarken'), false);
  assert.equal(blocked('Messerblock WMF'), false);
  assert.equal(blocked('Aktenschrank Metall'), false);
  assert.equal(blocked('Totem Holzfigur'), false);
});

test('photos are asked for bigger, with the original as the fallback', () => {
  assert.deepEqual(upsized('https://i.ebayimg.com/images/g/abc/s-l225.jpg'), [
    'https://i.ebayimg.com/images/g/abc/s-l960.jpg',
    'https://i.ebayimg.com/images/g/abc/s-l225.jpg',
  ]);
  assert.deepEqual(upsized('https://i.ebayimg.com/x/thumb'), ['https://i.ebayimg.com/x/thumb']);
});

/** A stand-in for eBay: a token endpoint and a search that answers from `pages`. */
function fakeEbay({ pages = () => [summary()], tokenStatus = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/identity/v1/oauth2/token')) {
      if (tokenStatus !== 200) return new Response('{}', { status: tokenStatus });
      return Response.json({ access_token: 'T0KEN', expires_in: 7200, token_type: 'Application Access Token' });
    }
    const params = new URL(url).searchParams;
    const found = pages(params.get('q'), Number(params.get('offset')));
    return Response.json({ total: found.length, itemSummaries: found });
  };
  return { fetch, calls };
}

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

test('a draw fetches one token, searches ebay.de and hands out our own photo paths', async () => {
  let n = 0;
  const { fetch, calls } = fakeEbay({
    pages: (q) => Array.from({ length: 6 }, () => summary({ itemId: `v1|${++n}|0`, title: `${q} Nummer ${n}` })),
  });
  const images = registry();
  const source = createEbaySource({ clientId: 'id', clientSecret: 'secret', images, fetch, random: () => 0 });
  const items = await source.draw({ count: 10, price: 'everyday', themes: ['garden', 'home'] });

  assert.equal(items.length, 10);
  assert.ok(items.every((i) => i.images.every((src) => src.startsWith('/img/'))));
  assert.deepEqual(images.registered[0], ['https://i.ebayimg.com/images/g/abc/s-l960.jpg', 'https://i.ebayimg.com/images/g/abc/s-l225.jpg']);

  const [auth, ...searches] = calls;
  assert.match(auth.url, /\/identity\/v1\/oauth2\/token$/);
  assert.equal(auth.init.headers.authorization, `Basic ${Buffer.from('id:secret').toString('base64')}`);
  assert.equal(String(auth.init.body), 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope');
  assert.equal(searches.length, 4);
  for (const search of searches) {
    const url = new URL(search.url);
    assert.equal(url.pathname, '/buy/browse/v1/item_summary/search');
    assert.equal(search.init.headers.authorization, 'Bearer T0KEN');
    assert.equal(search.init.headers['x-ebay-c-marketplace-id'], 'EBAY_DE');
    const filter = url.searchParams.get('filter');
    assert.match(filter, /price:\[5\.\.500\]/);
    assert.match(filter, /priceCurrency:EUR/);
    assert.match(filter, /buyingOptions:\{FIXED_PRICE\}/);
    assert.match(filter, /itemLocationCountry:DE/);
    assert.ok(!/7000/.test(filter), 'never "for parts"');
  }
  // The token is reused by the next draw.
  await source.draw({ count: 2, price: 'everyday', themes: ['toys'] });
  assert.equal(calls.filter((c) => c.url.endsWith('/oauth2/token')).length, 1);
});

test('the draw mixes keywords and skips items a room has seen', async () => {
  let n = 0;
  const { fetch } = fakeEbay({ pages: (q) => Array.from({ length: 5 }, () => summary({ itemId: `${q}-${++n}`, title: `${q} ${n}` })) });
  const source = createEbaySource({ clientId: 'id', clientSecret: 's', images: registry(), fetch, random: () => 0.5 });
  const items = await source.draw({ count: 8, price: 'everyday', themes: ['tech'], exclude: new Set(['ebay:Laptop-1']) });
  const keywords = new Set(items.map((i) => i.title.split(' ')[0]));
  assert.ok(keywords.size >= 3, [...keywords].join());
  assert.ok(items.every((i) => i.id !== 'ebay:Laptop-1'));
});

test('eBay failures arrive as short codes, and a failed token is fetched again next time', async () => {
  const bad = fakeEbay({ tokenStatus: 401 });
  const source = createEbaySource({ clientId: 'id', clientSecret: 's', images: registry(), fetch: bad.fetch });
  await assert.rejects(source.draw({ count: 3, price: 'all', themes: ['tech'] }), (e) => e instanceof SourceError && e.code === 'auth');
  await assert.rejects(source.draw({ count: 3, price: 'all', themes: ['tech'] }), { code: 'auth' });
  assert.equal(bad.calls.filter((c) => c.url.endsWith('/oauth2/token')).length, 2);

  const empty = fakeEbay({ pages: () => [] });
  const quiet = createEbaySource({ clientId: 'id', clientSecret: 's', images: registry(), fetch: empty.fetch });
  await assert.rejects(quiet.draw({ count: 3, price: 'all', themes: ['tech'] }), { code: 'empty' });

  const down = createEbaySource({ clientId: 'id', clientSecret: 's', images: registry(), fetch: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(down.draw({ count: 3, price: 'all', themes: ['tech'] }), { code: 'network' });
});

test('the keys pick the source; without them it is the demo list', () => {
  const images = registry();
  assert.equal(createSource({}, { images }).name, 'mock');
  assert.equal(createSource({ EBAY_CLIENT_ID: 'a' }, { images }).name, 'mock');
  assert.equal(createSource({ EBAY_CLIENT_ID: 'a', EBAY_CLIENT_SECRET: 'b' }, { images }).name, 'ebay');
  assert.equal(createSource({ EBAY_CLIENT_ID: 'a', EBAY_CLIENT_SECRET: 'b', SCHAETZLE_SOURCE: 'mock' }, { images }).name, 'mock');
});
