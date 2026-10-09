// npm run collect -- <files>: adds the collector's JSON files (tools/collector.mjs) to the item
// collection the game plays (server/items/collection.json). Listings it already has stay as they
// are; anything a game can't play is left out, and the summary says why.
//
//   npm run collect -- ~/Downloads/schaetzle-*.json

import { readFileSync, writeFileSync } from 'node:fs';
import { blocked, isTheme, PRICES } from '../server/items/themes.mjs';
import { COLLECTION_PATH, readCollection } from '../server/items/collection.mjs';

/** Conditions a game skips: broken things have no fair price to guess. */
const UNPLAYABLE = /ersatzteil|defekt|for parts/i;
const MAX_PRICE = PRICES.all[1];

/**
 * The collection with one collector file added.
 * @param {import('../server/items/collection.mjs').CollectionItem[]} collection
 * @param {any} file  a collector file's parsed JSON
 * @returns {{ collection: import('../server/items/collection.mjs').CollectionItem[], added: number, known: number, skipped: Record<string, number> }}
 */
export function addFile(collection, file) {
  if (file?.schaetzle !== 1 || !Array.isArray(file.items)) throw new Error('not a collector file');
  if (!isTheme(file.theme)) throw new Error(`unknown category "${file.theme}"`);
  const have = new Set(collection.map((item) => item.id));
  const next = [...collection];
  const skipped = {};
  const skip = (reason) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  let added = 0;
  let known = 0;
  for (const item of file.items) {
    const id = `ebay:${item?.id}`;
    if (typeof item?.id !== 'string' || !/^\d+$/.test(item.id)) skip('no id');
    else if (have.has(id)) known++;
    else if (typeof item.title !== 'string' || !item.title.trim()) skip('no title');
    else if (!(typeof item.price === 'number' && item.price >= 1 && item.price <= MAX_PRICE)) skip('no single price');
    else if (typeof item.image !== 'string' || !item.image.startsWith('https://i.ebayimg.com/')) skip('no photo');
    else if (UNPLAYABLE.test(item.condition ?? '')) skip('spare parts');
    else if (blocked(item.title)) skip('blocked title');
    else {
      have.add(id);
      added++;
      next.push({
        id,
        theme: file.theme,
        keyword: typeof file.keyword === 'string' ? file.keyword : '',
        title: item.title.trim(),
        price: Math.round(item.price * 100) / 100,
        // The seller type isn't a condition (files from before the bookmark knew that).
        condition: typeof item.condition === 'string' && !/^(Privat|Gewerblich)$/i.test(item.condition) ? item.condition : '',
        image: item.image,
        url: `https://www.ebay.de/itm/${item.id}`,
        sold: file.sold === true,
        soldOn: typeof item.soldOn === 'string' ? item.soldOn : null,
        collected: typeof file.collected === 'string' ? file.collected.slice(0, 10) : null,
      });
    }
  }
  next.sort((a, b) => a.theme.localeCompare(b.theme) || a.keyword.localeCompare(b.keyword) || a.id.localeCompare(b.id));
  return { collection: next, added, known, skipped };
}

/** One listing per line, so a diff shows what came in. */
export function formatCollection(collection) {
  return `[\n${collection.map((item) => `  ${JSON.stringify(item)}`).join(',\n')}\n]\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.log('npm run collect -- <collector files>   (see npm run collector)');
    process.exit(1);
  }
  let collection = readCollection(COLLECTION_PATH);
  for (const path of files) {
    try {
      const result = addFile(collection, JSON.parse(readFileSync(path, 'utf8')));
      collection = result.collection;
      const left = Object.entries(result.skipped).map(([reason, n]) => `${n} ${reason}`).join(', ');
      console.log(`${path}: ${result.added} added, ${result.known} already in${left ? `, left out: ${left}` : ''}`);
    } catch (error) {
      console.log(`${path}: ${error.message}`);
    }
  }
  writeFileSync(COLLECTION_PATH, formatCollection(collection));
  const counts = {};
  for (const item of collection) counts[item.theme] = (counts[item.theme] ?? 0) + 1;
  console.log(`\n${collection.length} listings in the collection: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ')}`);
}
