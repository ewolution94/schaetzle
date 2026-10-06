// Which listings a game draws: eBay's when its keys are set, the demo list otherwise.
//
//   EBAY_CLIENT_ID + EBAY_CLIENT_SECRET   live ebay.de listings (server/items/ebay.mjs)
//   neither                               the demo list (server/items/mock.mjs)
//   SCHAETZLE_SOURCE=mock                 the demo list even with keys (a fallback switch)

import { createEbaySource } from './ebay.mjs';
import { createMockSource } from './mock.mjs';

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ images: { register(candidates: string[]): string } }} deps
 */
export function createSource(env, { images }) {
  const id = env.EBAY_CLIENT_ID?.trim();
  const secret = env.EBAY_CLIENT_SECRET?.trim();
  if (env.SCHAETZLE_SOURCE !== 'mock' && id && secret) {
    return createEbaySource({ clientId: id, clientSecret: secret, images });
  }
  return createMockSource();
}
