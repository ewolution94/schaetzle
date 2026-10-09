// npm run collector: prints the bookmarklet that collects listings for Schätzle's item collection.
//
// The user opens an ebay.de search themselves (signed in, with the "Verkaufte Artikel" filter, so the
// prices are what things sold for), taps the bookmark, picks a category, and gets a JSON file. Those
// files go into the collection with `npm run collect -- <files>` (tools/collect.mjs). Nothing here
// talks to eBay: the bookmarklet only reads the page that's already open in the user's browser.
//
//   npm run collector             the bookmarklet, to paste as a bookmark's address
//   npm run collector -- --plain  the same code without `javascript:`, for the browser's console
//   npm run collector -- --ideas  search ideas per category (tools/search-ideas.mjs)

import { readSearchPage } from './ebay-page.mjs';
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
  if (process.argv.includes('--ideas')) {
    for (const [theme, ideas] of Object.entries(IDEAS)) console.log(`${theme}\n  ${ideas.join(', ')}\n`);
  } else if (process.argv.includes('--plain')) {
    console.log(collectorCode());
  } else {
    console.log(`Save this as a bookmark's address (URL), then tap the bookmark on an ebay.de search
results page (signed in, with "Verkaufte Artikel" ticked). It downloads a JSON file; add it with
npm run collect -- ~/Downloads/schaetzle-*.json\n`);
    console.log(bookmarklet());
  }
}
