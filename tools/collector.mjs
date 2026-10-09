// npm run collector: prints the bookmarklet that collects listings for Schätzle's item collection.
//
// The user opens an ebay.de search themselves (signed in, with the "Verkaufte Artikel" filter, so the
// prices are what things sold for), taps the bookmark, picks a category, and gets a JSON file. Those
// files go into the collection with `npm run collect -- <files>` (tools/collect.mjs). Nothing here
// talks to eBay: the bookmarklet only reads the page that's already open in the user's browser.
//
//   npm run collector             the checklist (which search ideas are in the collection, per
//                                 category), then the bookmarklet, also put on the clipboard
//   npm run collector -- --plain  the same code without `javascript:`, for the browser's console

import { execFileSync } from 'node:child_process';
import { readSearchPage } from './ebay-page.mjs';
import { COLLECTION_PATH, readCollection } from '../server/items/collection.mjs';
import { IDEAS } from './search-ideas.mjs';
import { THEMES } from '../server/items/themes.mjs';

/** The searches each category knows: the game's own keywords and the search ideas, once each. */
export const KNOWN = Object.fromEntries(Object.keys(THEMES).map((theme) => [theme, [...new Set([...THEMES[theme], ...IDEAS[theme]])]]));

/**
 * The category a search most likely belongs to, or ''. A search the lists name exactly wins
 * ("Kinositze" → odd); otherwise the most specific overlap ("Lego Technic 42100" → toys, through
 * "Lego"; "Schaufensterpuppe" stays odd although it holds "Puppe"). Inlined into the bookmarklet,
 * so it uses nothing from outside its own body.
 * @param {string} search
 * @param {Record<string, string[]>} lists
 */
export function guessTheme(search, lists) {
  const norm = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const query = norm(search);
  if (!query) return '';
  let best = '';
  let score = 0;
  for (const [theme, terms] of Object.entries(lists)) {
    for (const term of terms.map(norm)) {
      const s = term === query ? 1000 : query.includes(term) ? term.length : term.includes(query) ? query.length / 2 : 0;
      if (s > score) {
        score = s;
        best = theme;
      }
    }
  }
  return best;
}

/** The code the bookmark runs, as plain JavaScript. */
export function collectorCode() {
  return `(() => {
  const readSearchPage = ${readSearchPage.toString()};
  const guessTheme = ${guessTheme.toString()};
  const THEMES = ${JSON.stringify(KNOWN)};
  if (!/^https:\\/\\/www\\.ebay\\.de\\/sch\\//.test(location.href)) {
    alert('Schätzle: run this on an ebay.de search results page.');
    return;
  }
  const all = readSearchPage(document.documentElement.outerHTML);
  const items = all.filter((item) => item.price !== null && item.image && item.title);
  const params = new URLSearchParams(location.search);
  const keyword = (params.get('_nkw') || '').trim();
  const sold = params.get('LH_Sold') === '1';
  if (!items.length) {
    alert('Schätzle: no listings found on this page (' + all.length + ' cards). Has eBay changed its page?');
    return;
  }
  const guess = guessTheme(keyword, THEMES);
  const skipped = all.length - items.length;
  const answer = prompt(
    'Schätzle: ' + items.length + ' listings for "' + keyword + '"'
      + (skipped ? ' (' + skipped + ' without a single price or photo left out)' : '')
      + (sold ? ', sold.' : '. NOT sold: the "Verkaufte Artikel" filter is off, these are asking prices.')
      + '\\n\\nCategory: ' + Object.keys(THEMES).join(', '),
    guess,
  );
  if (answer === null) return;
  const theme = answer.trim();
  if (!THEMES[theme]) {
    alert('Schätzle: unknown category "' + theme + '".');
    return;
  }
  const data = { schaetzle: 1, collected: new Date().toISOString(), page: location.href, keyword, sold, theme, items };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  link.download = 'schaetzle-' + theme + '-' + (keyword.replace(/[^\\p{L}\\p{N}]+/gu, '-').toLowerCase() || 'page') + '-' + Date.now() + '.json';
  document.body.append(link);
  link.click();
  link.remove();
})();`;
}

const norm = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Which search ideas the collection already has, per category: an idea counts as done when a search
 * was that idea or a more specific one ("Weber Kugelgrill 57 cm" ticks "Weber Kugelgrill"). Searches
 * that aren't ideas come back as `others`.
 * @param {import('../server/items/collection.mjs').CollectionItem[]} collection
 * @param {Record<string, string[]>} ideas
 */
export function checklist(collection, ideas) {
  return Object.entries(ideas).map(([theme, list]) => {
    const mine = collection.filter((item) => item.theme === theme);
    const bySearch = new Map();
    for (const item of mine) bySearch.set(norm(item.keyword), (bySearch.get(norm(item.keyword)) ?? 0) + 1);
    const matched = new Set();
    const rows = list.map((idea) => {
      let count = 0;
      for (const [search, n] of bySearch) {
        if (search === norm(idea) || search.includes(norm(idea))) {
          count += n;
          matched.add(search);
        }
      }
      return { idea, count };
    });
    const others = [...bySearch].filter(([search]) => search && !matched.has(search)).map(([search, count]) => ({ search, count }));
    return { theme, listings: mine.length, searches: bySearch.size, done: rows.filter((r) => r.count).length, rows, others };
  });
}

/** The checklist as text: ✓ done (listings), · still open. */
export function formatChecklist(list) {
  return list
    .map(({ theme, listings, searches, done, rows, others }) => {
      const head = `${theme}: ${listings} listings from ${searches} searches, ${done} of ${rows.length} ideas done`;
      const lines = rows.map((r) => (r.count ? `  ✓ ${r.idea} (${r.count})` : `  · ${r.idea}`));
      const more = others.length ? [`  + also: ${others.map((o) => `${o.search} (${o.count})`).join(', ')}`] : [];
      return [head, ...lines, ...more].join('\n');
    })
    .join('\n\n');
}

/** The bookmark's address: the code without its comments and indentation, so it stays short. */
export function bookmarklet() {
  const code = collectorCode()
    .replace(/\/\*\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n\s*/g, '\n')
    .replace(/\n+/g, '\n');
  return `javascript:${encodeURIComponent(code)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--plain')) {
    console.log(collectorCode());
  } else {
    console.log(formatChecklist(checklist(readCollection(COLLECTION_PATH), IDEAS)));
    const address = bookmarklet();
    let copied = false;
    try {
      execFileSync('pbcopy', { input: address });
      copied = true;
    } catch {
      // not a Mac, or no clipboard: copy the line below by hand
    }
    console.log(`\n${'─'.repeat(72)}
The bookmark${copied ? ' (already on your clipboard)' : ''}: save it as a bookmark's address (URL). On
ebay.de, signed in, search and tick "Verkaufte Artikel", then tap the bookmark. Add the file it
downloads with: npm run collect -- ~/Downloads/schaetzle-*.json
${'─'.repeat(72)}\n`);
    console.log(address);
  }
}
