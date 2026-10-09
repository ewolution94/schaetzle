// The real source: live fixed-price listings from ebay.de through eBay's Browse API.
//
// It switches itself on when EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are set (server/items/index.mjs).
// One game costs a handful of searches; eBay's default limit is 5,000 calls a day, and DAILY_LIMIT
// stops well before it.
//
// eBay's API license allows listing data to be shown for at most 6 hours. Nothing here is kept
// longer: items live in a game's memory, and the photo pass-through (server/images.mjs) forgets
// them after 6 hours. That's also why the keyset opts out of eBay's account-deletion
// notifications with "not persisting eBay data" (README → eBay).
//
// Docs: https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
//       https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html

import { PRICES, THEMES, blocked } from './themes.mjs';
import { shuffle } from './mock.mjs';

/** @typedef {import('./mock.mjs').Item} Item */
/** @typedef {import('./themes.mjs').Theme} Theme */

const API = 'https://api.ebay.com';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';
/** Searches per draw: enough keywords for variety, few enough to stay cheap. */
const SEARCHES = 4;
const PAGE = 50;
/** New, opened, refurbished and the used grades; never "for parts or not working" (7000). */
const CONDITIONS = '1000|1500|1750|2000|2010|2020|2030|2500|2750|3000|4000|5000|6000';
const DAILY_LIMIT = 4000;
const TIMEOUT = 8000;

/** A failure the game can name without leaking eBay's message: 'auth', 'quota', 'http-503', 'network', 'empty'. */
export class SourceError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(`ebay: ${code}`);
    this.code = code;
  }
}

/**
 * @param {{
 *   clientId: string,
 *   clientSecret: string,
 *   images: { register(candidates: string[]): string },
 *   marketplace?: string,
 *   fetch?: typeof globalThis.fetch,
 *   now?: () => number,
 *   random?: () => number,
 *   api?: string,
 * }} options
 */
export function createEbaySource({ clientId, clientSecret, images, marketplace = 'EBAY_DE', fetch = globalThis.fetch, now = Date.now, random = Math.random, api = API }) {
  /** @type {{ token: string, expires: number } | null} */
  let current = null;
  /** @type {Promise<{ token: string, expires: number }> | null} */
  let pending = null;
  let day = '';
  let calls = 0;

  function count() {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      calls = 0;
    }
    if (calls >= DAILY_LIMIT) throw new SourceError('quota');
    calls++;
  }

  async function call(url, init) {
    count();
    let response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
    } catch {
      throw new SourceError('network');
    }
    if (response.status === 401 || response.status === 403) throw new SourceError('auth');
    if (response.status === 429) throw new SourceError('quota');
    if (!response.ok) throw new SourceError(`http-${response.status}`);
    return response.json();
  }

  /**
   * The application token, fetched once and reused until shortly before it expires. Searches that
   * start together share one fetch; a failed one isn't kept, so the next game tries again
   * (learnings/node-server.md: cache the promise, not the result).
   */
  async function token() {
    if (current && current.expires - 5 * 60_000 > now()) return current.token;
    pending ??= (async () => {
      const body = new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE });
      const data = await call(`${api}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (typeof data?.access_token !== 'string') throw new SourceError('auth');
      return { token: data.access_token, expires: now() + Number(data.expires_in ?? 7200) * 1000 };
    })().finally(() => {
      pending = null;
    });
    current = await pending;
    return current.token;
  }

  /** One page of fixed-price listings in Germany for a keyword. */
  async function search(keyword, [min, max], offset) {
    const params = new URLSearchParams({
      q: keyword,
      limit: String(PAGE),
      offset: String(offset),
      filter: [
        `price:[${min}..${max}]`,
        'priceCurrency:EUR',
        'buyingOptions:{FIXED_PRICE}',
        'itemLocationCountry:DE',
        `conditionIds:{${CONDITIONS}}`,
      ].join(','),
    });
    const data = await call(`${api}/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        authorization: `Bearer ${await token()}`,
        'x-ebay-c-marketplace-id': marketplace,
        'accept-language': 'de-DE',
        accept: 'application/json',
      },
    });
    return Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
  }

  return {
    name: 'ebay',
    demo: false,
    /**
     * @param {{ count: number, price: import('./themes.mjs').PriceRange, themes: Theme[], exclude?: Set<string> }} request
     * @returns {Promise<Item[]>}
     */
    async draw({ count, price, themes, exclude = new Set() }) {
      const range = PRICES[price];
      const keywords = shuffle(
        themes.flatMap((theme) => THEMES[theme].map((keyword) => ({ theme, keyword }))),
        random,
      ).slice(0, SEARCHES);

      // Each keyword is one bucket; a random page of it first, the first page if that's empty.
      const buckets = await Promise.all(
        keywords.map(async ({ theme, keyword }) => {
          const offset = PAGE * Math.floor(random() * 3);
          let found = await search(keyword, range, offset);
          if (!found.length && offset) found = await search(keyword, range, 0);
          return shuffle(
            found.map((summary) => toItem(summary, theme, range)).filter((item) => item && !exclude.has(item.id)),
            random,
          );
        }),
      );

      const picked = mix(buckets, count);
      if (!picked.length) throw new SourceError('empty');

      return picked.map((item) => ({ ...item, images: item.images.map((url) => images.register(upsized(url))) }));
    },
  };
}

/**
 * Round-robin over the buckets (one per keyword), so a game mixes its keywords instead of showing ten
 * lamps; the same title twice counts once. Shared with the collection (collection.mjs).
 * @template {{ title: string }} T
 * @param {T[][]} buckets
 * @param {number} count
 * @returns {T[]}
 */
export function mix(buckets, count) {
  const picked = [];
  const titles = new Set();
  for (let i = 0; picked.length < count && buckets.some((b) => i < b.length); i++) {
    for (const bucket of buckets) {
      const item = bucket[i];
      if (!item || picked.length >= count) continue;
      const key = item.title.toLowerCase().replace(/\W+/g, ' ').trim();
      if (titles.has(key)) continue;
      titles.add(key);
      picked.push(item);
    }
  }
  return picked;
}

/**
 * A search result as a game item, or null when it can't be played: no photo, no euro price, out of
 * range, or a title that has no place in a work meeting.
 * @returns {(Item & { images: string[] }) | null}
 */
export function toItem(summary, theme, [min, max]) {
  if (!summary || typeof summary.itemId !== 'string' || typeof summary.title !== 'string') return null;
  if (summary.price?.currency !== 'EUR') return null;
  const price = Number(summary.price.value);
  if (!(price >= min && price <= max)) return null;
  if (blocked(summary.title)) return null;

  const photos = [summary.image?.imageUrl, ...(summary.additionalImages ?? []).map((image) => image?.imageUrl)]
    .filter((url) => typeof url === 'string' && url.startsWith('https://i.ebayimg.com/'))
    .slice(0, 4);
  if (!photos.length) return null;

  return {
    id: `ebay:${summary.itemId}`,
    theme,
    title: summary.title.trim(),
    condition: typeof summary.condition === 'string' ? summary.condition : '',
    images: [...new Set(photos)],
    art: null,
    price,
    url: typeof summary.itemWebUrl === 'string' && summary.itemWebUrl.startsWith('https://www.ebay.de/') ? summary.itemWebUrl : null,
  };
}

/**
 * Search results carry small photos (s-l225). eBay serves the same picture at other sizes under
 * s-l<size>; that's undocumented, so the original stays behind it as the fallback.
 * @returns {string[]}  candidates, best first
 */
export function upsized(url) {
  const big = url.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)$/i, '/s-l960.$1');
  return big === url ? [url] : [big, url];
}
