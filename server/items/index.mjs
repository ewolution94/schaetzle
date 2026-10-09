// Which listings a game draws.
//
//   EBAY_CLIENT_ID + EBAY_CLIENT_SECRET   live ebay.de listings through eBay's Browse API (ebay.mjs)
//   otherwise                             the collection (collection.mjs): listings the user gathered
//                                         with the collector bookmarklet, when there are any
//   an empty collection                   the demo list (mock.mjs)
//   SCHAETZLE_SOURCE=mock                 the demo list, whatever else is set
//   SCHAETZLE_DATA=/data                  where the collection's rotation is kept (rotation.mjs);
//                                         unset, it lives in memory until the next restart
//
// eBay declined the user's developer account (2026-10-09); the user chose to gather sold listings
// themselves instead of having the server read eBay live. A game the collection can't fill (too few
// listings in the host's range) plays the demo list instead, labelled as demo.

import { createEbaySource } from './ebay.mjs';
import { COLLECTION_PATH, createCollectionSource, readCollection } from './collection.mjs';
import { createRotation } from './rotation.mjs';
import { createMockSource } from './mock.mjs';

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ images: { register(candidates: string[]): string }, collection?: string, log?: (message: string) => void }} deps
 */
export function createSource(env, { images, collection = COLLECTION_PATH, log = (m) => console.warn(m) }) {
  if (env.SCHAETZLE_SOURCE === 'mock') return createMockSource();
  const id = env.EBAY_CLIENT_ID?.trim();
  const secret = env.EBAY_CLIENT_SECRET?.trim();
  if (id && secret) return createEbaySource({ clientId: id, clientSecret: secret, images });
  const items = readCollection(collection);
  if (!items.length) return createMockSource();
  const rotation = createRotation({ dir: env.SCHAETZLE_DATA?.trim() || null, log });
  return withFallback(createCollectionSource({ items, images, rotation }), createMockSource(), log);
}

/**
 * The primary source, and the demo list for a game it can't serve. The game tells from the items
 * which it got (demo items carry `art`), so only that game says "demo".
 * @param {import('../game.mjs').Source} primary
 * @param {import('../game.mjs').Source} fallback
 * @param {(message: string) => void} log
 */
export function withFallback(primary, fallback, log) {
  return {
    name: primary.name,
    demo: primary.demo,
    async draw(request) {
      try {
        return await primary.draw(request);
      } catch (error) {
        log(`${primary.name}: ${error?.code ?? error?.message ?? error}; this game plays the demo items`);
        return fallback.draw(request);
      }
    },
  };
}
