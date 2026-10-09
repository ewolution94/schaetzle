// The collection: real ebay.de listings the user gathered with the collector bookmarklet
// (tools/collector.mjs, tools/collect.mjs), kept in collection.json next to this file. Mostly sold
// listings, so a price is what the thing actually sold for. Nothing talks to eBay while a game runs,
// except the photos, which pass through our origin (server/images.mjs).
//
// A game draws from the host's categories and price range, mixing the search keywords the listings
// were collected under, so ten rounds aren't ten lamps. Short of listings there, it takes other
// categories in the same range; short even then, it fails and the game plays the demo items
// (index.mjs → withFallback).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRICES } from './themes.mjs';
import { shuffle } from './mock.mjs';
import { SourceError, mix, upsized } from './ebay.mjs';

/** @typedef {import('./mock.mjs').Item} Item */
/** @typedef {import('./themes.mjs').Theme} Theme */

/**
 * @typedef {{
 *   id: string,
 *   theme: Theme,
 *   keyword: string,
 *   title: string,
 *   price: number,
 *   condition: string,
 *   image: string,
 *   url: string,
 *   sold: boolean,
 *   soldOn: string | null,
 *   collected: string | null,
 * }} CollectionItem
 */

export const COLLECTION_PATH = fileURLToPath(new URL('./collection.json', import.meta.url));

/**
 * The collection on disk; empty when the file is missing or isn't one.
 * @param {string} path
 * @returns {CollectionItem[]}
 */
export function readCollection(path) {
  try {
    const items = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(items) ? items.filter((item) => item && typeof item.id === 'string' && typeof item.price === 'number') : [];
  } catch {
    return [];
  }
}

/**
 * @param {{ items: CollectionItem[], images: { register(candidates: string[]): string }, random?: () => number }} options
 */
export function createCollectionSource({ items, images, random = Math.random }) {
  return {
    name: 'collection',
    demo: false,
    size: items.length,
    /**
     * @param {{ count: number, price: import('./themes.mjs').PriceRange, themes: Theme[], exclude?: Set<string> }} request
     * @returns {Promise<Item[]>}
     */
    async draw({ count, price, themes, exclude = new Set() }) {
      const [min, max] = PRICES[price];
      const fresh = items.filter((item) => !exclude.has(item.id) && item.price >= min && item.price <= max);
      const picked = [];
      const taken = new Set();
      // The host's categories first, then the others in the same range.
      for (const tier of [fresh.filter((item) => themes.includes(item.theme)), fresh]) {
        const left = tier.filter((item) => !taken.has(item.id));
        const byKeyword = new Map();
        for (const item of shuffle(left, random)) {
          const key = `${item.theme}|${item.keyword}`;
          if (!byKeyword.has(key)) byKeyword.set(key, []);
          byKeyword.get(key).push(item);
        }
        for (const item of mix(shuffle([...byKeyword.values()], random), count - picked.length)) {
          taken.add(item.id);
          picked.push(item);
        }
        if (picked.length >= count) break;
      }
      if (picked.length < count) throw new SourceError('empty');
      return picked.map((item) => ({
        id: item.id,
        theme: item.theme,
        title: item.title,
        condition: item.condition,
        images: [images.register(upsized(item.image))],
        art: null,
        price: item.price,
        url: item.url,
      }));
    },
  };
}
