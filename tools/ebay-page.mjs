// Reads the listings off an ebay.de search results page (the 2026 `s-card` markup), for the
// collector (tools/collector.mjs builds it into a bookmarklet the user runs on a page they opened
// themselves) and its tests. One function with its helpers inside, so its source can be inlined
// into the bookmarklet as it is: it must not use anything from outside its own body.
//
// It takes the page as HTML text: eBay's raw markup (unquoted attributes) and a browser's
// `document.documentElement.outerHTML` (quoted) both work.

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   price: number | null,
 *   condition: string,
 *   image: string | null,
 *   url: string,
 *   soldOn: string | null,
 * }} PageItem
 */

/**
 * The listings on one results page. eBay's own adverts (cards without an item id) are left out; a
 * price range ("EUR 10,00 bis EUR 20,00", a listing with variants) comes back as price null.
 * @param {string} html
 * @returns {PageItem[]}
 */
export function readSearchPage(html) {
  /** An attribute's value in a tag, quoted or not. */
  const attr = (tag, name) => {
    const match = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(tag);
    return match ? (match[1] ?? match[2] ?? match[3]) : null;
  };
  /** The whole tag starting at `start`: up to the first `>` outside quotes (an img's onload holds code). */
  const tagAt = (text, start) => {
    if (start < 0) return '';
    let quote = '';
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') return text.slice(start, i + 1);
    }
    return '';
  };
  /** The text of some markup, its tags turned into separators. */
  const plain = (markup) => markup.replace(/<[^>]*>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '');
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const decode = (value) =>
    value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
      if (entity[0] === '#') {
        const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return entities[entity.toLowerCase()] ?? whole;
    });
  /** "EUR 1.249,90" → 1249.9; a range, or anything else, → null. */
  const euros = (text) => {
    if (/bis/i.test(text)) return null;
    const match = /EUR\s*([\d.]+,\d{2})/.exec(text.replace(/ /g, ' '));
    if (!match) return null;
    const value = Number(match[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  // The class attribute, quoted or not, holding `name` (alone or among others).
  const cls = (name) => `class=(?:"[^"]*\\b${name}\\b[^"]*"|${name})`;

  const items = [];
  for (const chunk of html.split(/<li class="s-card[ "]/).slice(1)) {
    const card = chunk.split(/<li class="s-card[ "]|<\/ul>/)[0];
    const id = /https:\/\/www\.ebay\.de\/itm\/(\d+)/.exec(card)?.[1];
    if (!id) continue;

    // The photo: the img carrying s-card__image. A lazy one keeps its real address in data-src.
    const at = card.indexOf('s-card__image');
    const tag = at < 0 ? '' : tagAt(card, card.lastIndexOf('<img', at));
    const src = [attr(tag, 'data-src'), attr(tag, 'src')].find((url) => url && url.startsWith('https://i.ebayimg.com/')) ?? null;
    const alt = attr(tag, 'alt');
    const titleMarkup = new RegExp(`${cls('s-card__title')}>([\\s\\S]*?)<\\/div>`).exec(card)?.[1] ?? '';
    const title = decode(alt || plain(titleMarkup).split('|').find((part) => !/^(Neues Angebot|Wird in neuem Fenster oder Tab geöffnet)$/.test(part.trim())) || '')
      .replace(/\s+/g, ' ')
      .trim();

    const priceText = decode(new RegExp(`${cls('s-card__price')}[^>]*>([\\s\\S]*?)<\\/span>`).exec(card)?.[1] ?? '').replace(/<[^>]*>/g, '');
    // The last subtitle row is "Neu | Gewerblich"; the condition is its first part. Without a
    // condition, only the seller type is left there ("Privat"): that's no condition.
    const subtitles = [...card.matchAll(new RegExp(`${cls('s-card__subtitle')}>([\\s\\S]*?)<\\/div>`, 'g'))];
    const first = decode(plain(subtitles.at(-1)?.[1] ?? '').split('|')[0] ?? '').trim();
    const condition = /^(Privat|Gewerblich)$/i.test(first) ? '' : first;
    // A sold listing says when: "Verkauft  5. Okt 2026" (sometimes "Verkauft am …").
    const sold = /Verkauft(?:\s+am)?\s+(\d{1,2})\.\s*([A-Za-zäÄ]{3,4})\.?\s+(\d{4})/.exec(plain(card).replace(/&nbsp;| /g, ' '));
    const months = { jan: 1, feb: 2, mär: 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12 };
    const month = sold ? months[sold[2].toLowerCase().slice(0, 3)] : undefined;

    items.push({
      id,
      title,
      price: euros(priceText),
      condition,
      image: src,
      url: `https://www.ebay.de/itm/${id}`,
      soldOn: sold && month ? `${sold[3]}-${String(month).padStart(2, '0')}-${sold[1].padStart(2, '0')}` : null,
    });
  }
  return items;
}
