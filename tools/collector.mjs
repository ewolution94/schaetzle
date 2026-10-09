// npm run collector: prints the bookmarklet that collects listings for Schätzle's item collection.
//
// The user opens an ebay.de search themselves (signed in, with the "Verkaufte Artikel" filter, so the
// prices are what things sold for), taps the bookmark, picks a category, and gets a JSON file. Those
// files go into the collection with `npm run collect -- <files>` (tools/collect.mjs). Nothing here
// talks to eBay: the bookmarklet only reads the page that's already open in the user's browser.
//
//   npm run collector             the bookmarklet, to paste as a bookmark's address
//   npm run collector -- --plain  the same code without `javascript:`, for the browser's console

import { readSearchPage } from './ebay-page.mjs';
import { THEMES } from '../server/items/themes.mjs';

/** The code the bookmark runs, as plain JavaScript. */
export function collectorCode() {
  return `(() => {
  const readSearchPage = ${readSearchPage.toString()};
  const THEMES = ${JSON.stringify(THEMES)};
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
  const lower = keyword.toLowerCase();
  const guess = Object.keys(THEMES).find((t) => THEMES[t].some((k) => k.toLowerCase() === lower))
    || Object.keys(THEMES).find((t) => THEMES[t].some((k) => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)))
    || '';
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
  if (process.argv.includes('--plain')) {
    console.log(collectorCode());
  } else {
    console.log(`Save this as a bookmark's address (URL), then tap the bookmark on an ebay.de search
results page (signed in, with "Verkaufte Artikel" ticked). It downloads a JSON file; add it with
npm run collect -- ~/Downloads/schaetzle-*.json\n`);
    console.log(bookmarklet());
  }
}
