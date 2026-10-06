// What a game draws from: themes the host picks, and a price range.
//
// The themes are curated on purpose. A game runs in a work meeting, so the draw only searches
// these keywords (no random category), and BLOCKED keeps the rest of eBay out of it.

/** @typedef {'tech' | 'home' | 'kitchen' | 'fashion' | 'toys' | 'collect' | 'outdoor' | 'garden' | 'odd'} Theme */

/** Each theme with the eBay search terms it draws from. The labels live in the client. */
export const THEMES = /** @type {const} */ ({
  tech: ['Kopfhörer', 'Smartphone', 'Laptop', 'Spielkonsole', 'Digitalkamera', 'Bluetooth Lautsprecher', 'Smartwatch', 'Tablet', 'Plattenspieler', 'E-Reader'],
  home: ['Sessel', 'Stehlampe', 'Teppich', 'Vase', 'Wanduhr', 'Spiegel', 'Kommode', 'Kerzenständer', 'Sofa', 'Regal'],
  kitchen: ['Kaffeevollautomat', 'Küchenmaschine', 'Wasserkocher', 'Toaster', 'Topfset', 'Messerblock', 'Standmixer', 'Espressokocher', 'Waffeleisen'],
  fashion: ['Sneaker', 'Lederjacke', 'Handtasche', 'Armbanduhr', 'Sonnenbrille', 'Rucksack', 'Jeans', 'Winterjacke', 'Schal'],
  toys: ['Lego', 'Playmobil', 'Brettspiel', 'Puppe', 'Modelleisenbahn', 'Carrera Bahn', 'Kuscheltier', 'Holzspielzeug', 'Puzzle'],
  collect: ['Schallplatte', 'Briefmarken Sammlung', 'Sammelkarten', 'Porzellan', 'Modellauto', 'Comic', 'Postkarte', 'Sammeltasse', 'Steiff'],
  outdoor: ['Fahrrad', 'Zelt', 'Inliner', 'Tischtennisschläger', 'Angelrute', 'Skateboard', 'Hantel', 'Schlafsack', 'Wanderschuhe'],
  garden: ['Akkuschrauber', 'Rasenmäher', 'Gartenzwerg', 'Werkzeugkoffer', 'Kugelgrill', 'Gartenstuhl', 'Hochdruckreiniger', 'Schubkarre', 'Vogelhaus'],
  odd: ['Kurios', 'Kitsch', 'Retro Deko', 'Nostalgie', 'Partydeko', 'Wackeldackel', 'Schneekugel', 'Lavalampe', 'Sammlerstück'],
});

/** @type {Theme[]} */
export const THEME_KEYS = /** @type {Theme[]} */ (Object.keys(THEMES));

/** Price ranges in euros, inclusive. */
export const PRICES = /** @type {const} */ ({
  small: [1, 50],
  everyday: [5, 500],
  all: [5, 20000],
});

/** @typedef {keyof typeof PRICES} PriceRange */

/**
 * Words that keep a listing out of a game, matched as whole words in the title, case-insensitive.
 * eBay's search can surface anything for a harmless keyword ("Sammlerstück" finds militaria).
 */
const BLOCKED_WORDS = [
  'sex', 'sexy', 'erotik', 'erotisch', 'erotic', 'porno', 'nackt', 'nude', 'fetisch', 'fetish', 'dessous', 'lingerie', 'reizwäsche', 'dildo', 'vibrator', 'kondom', 'kondome', 'bdsm', 'latex', 'stripper',
  'waffe', 'waffen', 'pistole', 'revolver', 'gewehr', 'munition', 'softair', 'airsoft', 'schreckschuss', 'bajonett', 'dolch', 'schlagring',
  'wehrmacht', 'nsdap', 'hakenkreuz', 'ss', 'reich', 'hitler', 'nazi', 'militaria', 'orden', 'stahlhelm',
  'cbd', 'thc', 'cannabis', 'bong', 'shisha', 'vape', 'e-zigarette', 'tabak',
  'tot', 'präparat', 'tierpräparat', 'schädel', 'leiche',
];
const BLOCKED = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${BLOCKED_WORDS.map(escape).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');

function escape(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when a title has no place in a work meeting. */
export function blocked(title) {
  return BLOCKED.test(title);
}

/** @param {unknown} value */
export function isTheme(value) {
  return typeof value === 'string' && Object.hasOwn(THEMES, value);
}

/** @param {unknown} value */
export function isPriceRange(value) {
  return typeof value === 'string' && Object.hasOwn(PRICES, value);
}
