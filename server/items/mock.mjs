// The demo source: made-up listings with estimated prices, used until the eBay keys are set
// (server/items/index.mjs). No photos: each item shows a large emoji on a soft tint instead,
// and the game says "demo" wherever it matters, so nobody takes these for real offers.
//
// The prices are rough eBay.de prices for the thing as described, rounded the way sellers do.

import { PRICES } from './themes.mjs';

/** @typedef {import('./themes.mjs').Theme} Theme */
/** @typedef {'beige' | 'blue' | 'green' | 'mint' | 'orange' | 'pink' | 'purple' | 'yellow' | 'warm'} Tint */

/** @type {Array<[Theme, string, Tint, string, string, number]>}  theme, emoji, tint, condition, title, price */
const ROWS = [
  ['tech', '📱', 'blue', 'Gebraucht', 'Apple iPhone 13 128GB Mitternacht, sehr guter Zustand, Akku 89 %', 379],
  ['tech', '🎧', 'purple', 'Gebraucht', 'Sony WH-1000XM4 Noise Cancelling Kopfhörer schwarz mit Case', 139],
  ['tech', '🎮', 'mint', 'Gebraucht', 'Nintendo Switch OLED weiß mit OVP und 2 Spielen', 249],
  ['tech', '💻', 'blue', 'Gebraucht', 'Apple MacBook Air M1 8GB 256GB Space Grau', 529],
  ['tech', '🕹️', 'purple', 'Gebraucht', 'Sony PlayStation 5 Disc Edition mit Controller', 349],
  ['tech', '📷', 'beige', 'Gebraucht', 'Polaroid SX-70 Sofortbildkamera, getestet, funktioniert', 219],
  ['tech', '📺', 'yellow', 'Gebraucht', 'Sony Trinitron Röhrenfernseher 21 Zoll mit Fernbedienung', 25],
  ['tech', '🎮', 'green', 'Gebraucht', 'Game Boy Color lila mit Pokémon Gelb', 115],
  ['tech', '💾', 'beige', 'Gebraucht', 'Commodore C64 mit Datasette, Joystick und 20 Spielen', 149],
  ['tech', '⌚', 'mint', 'Neu', 'Apple Watch Series 9 45mm GPS Mitternacht, versiegelt', 359],
  ['tech', '🔊', 'orange', 'Gebraucht', 'JBL Charge 5 Bluetooth Lautsprecher blau', 89],
  ['tech', '📖', 'beige', 'Neu', 'Kindle Paperwhite 16GB, 2024, ohne Werbung', 159],
  ['tech', '🎶', 'warm', 'Gebraucht', 'Technics SL-1210 MK2 Plattenspieler', 549],
  ['tech', '🖨️', 'blue', 'Gebraucht', 'HP LaserJet Pro Drucker, nur 1.200 Seiten gedruckt', 79],
  ['tech', '📟', 'green', 'Gebraucht', 'Original Tamagotchi von 1997, funktioniert', 45],
  ['home', '🛋️', 'beige', 'Gebraucht', 'Ledersofa 3-Sitzer Cognac, Vintage, Selbstabholung Hamburg', 420],
  ['home', '🪑', 'beige', 'Gebraucht', 'IKEA Poäng Sessel Birke mit Bezug beige', 45],
  ['home', '💡', 'yellow', 'Gebraucht', 'Artemide Tolomeo Schreibtischleuchte Alu', 189],
  ['home', '🪞', 'pink', 'Gebraucht', 'Großer Barockspiegel goldfarben 120 × 80 cm', 95],
  ['home', '🕰️', 'beige', 'Gebraucht', 'Kienzle Wanduhr 70er Jahre, läuft', 35],
  ['home', '🏺', 'mint', 'Gebraucht', 'Fat Lava Vase Scheurich 70er, 40 cm', 59],
  ['home', '🧺', 'green', 'Neu', 'IKEA Kallax Regal 4 × 4 weiß, noch verpackt', 89],
  ['home', '🕯️', 'yellow', 'Gebraucht', 'Weihnachtspyramide Erzgebirge 3-stöckig, Original', 169],
  ['home', '🛏️', 'blue', 'Neu', 'Bettwäsche-Set Mako-Satin 155 × 220, 2-teilig', 39],
  ['home', '🌿', 'green', 'Gebraucht', 'Monstera Deliciosa 1,20 m im Keramiktopf', 49],
  ['home', '🧸', 'pink', 'Neu', 'Kuscheldecke XXL Teddyfleece rosa', 25],
  ['kitchen', '☕', 'beige', 'Generalüberholt', "De'Longhi Magnifica S Kaffeevollautomat, entkalkt", 159],
  ['kitchen', '🥣', 'warm', 'Gebraucht', 'KitchenAid Artisan Küchenmaschine 4,8 l Empire Rot', 329],
  ['kitchen', '🍲', 'mint', 'Gebraucht', 'Vorwerk Thermomix TM6 mit Varoma und Zubehör', 849],
  ['kitchen', '🫖', 'blue', 'Neu', 'Smeg Wasserkocher KLF03 Pastellblau', 99],
  ['kitchen', '🍞', 'yellow', 'Gebraucht', 'Hello Kitty Toaster, druckt das Gesicht aufs Brot', 29],
  ['kitchen', '🔪', 'beige', 'Neu', 'WMF Messerblock 6-teilig Edelstahl', 89],
  ['kitchen', '🥘', 'orange', 'Gebraucht', 'Le Creuset Bräter rund 24 cm Volcanic', 129],
  ['kitchen', '🧇', 'yellow', 'Gebraucht', 'Waffeleisen Cloer Herzform', 19],
  ['kitchen', '🥡', 'green', 'Neu', 'Tupperware Konvolut 25 Teile, teils neu', 39],
  ['kitchen', '🍳', 'warm', 'Neu', 'Fissler Pfannenset 3-teilig, Induktion', 119],
  ['kitchen', '☕', 'mint', 'Gebraucht', 'Bialetti Moka Express 6 Tassen', 22],
  ['fashion', '👟', 'mint', 'Neu', 'Adidas Samba OG weiß/schwarz Gr. 42, neu mit Karton', 99],
  ['fashion', '🧥', 'beige', 'Gebraucht', 'Barbour Bedale Wachsjacke Oliv, Größe 50', 139],
  ['fashion', '👜', 'pink', 'Gebraucht', 'Michael Kors Handtasche Jet Set Leder schwarz', 79],
  ['fashion', '⌚', 'yellow', 'Gebraucht', 'Rolex Submariner Date 116610LN, Box & Papiere 2016', 10900],
  ['fashion', '👖', 'blue', 'Gebraucht', "Levi's 501 Vintage W32 L32, Made in USA", 49],
  ['fashion', '🕶️', 'beige', 'Gebraucht', 'Ray-Ban Wayfarer RB2140 schwarz', 69],
  ['fashion', '🎒', 'orange', 'Gebraucht', 'Fjällräven Kånken Rucksack Gelb', 39],
  ['fashion', '🧣', 'warm', 'Neu', 'Kaschmir-Schal Burberry Check, neu mit Etikett', 289],
  ['fashion', '👔', 'blue', 'Gebraucht', 'Hugo Boss Anzug Slim Fit dunkelblau Gr. 48', 119],
  ['fashion', '⚽', 'green', 'Gebraucht', 'DFB Trikot WM 2014 Götze #19, getragen', 69],
  ['toys', '🚀', 'blue', 'Neu', 'LEGO Star Wars 75192 Millennium Falcon UCS, neu & versiegelt', 789],
  ['toys', '🏴‍☠️', 'beige', 'Gebraucht', 'Playmobil Piratenschiff 5135, vollständig mit Anleitung', 59],
  ['toys', '🎲', 'orange', 'Gebraucht', 'Catan Basisspiel, vollständig, 2015', 18],
  ['toys', '🚂', 'warm', 'Gebraucht', 'Märklin H0 Dampflok BR 01 Digital mit Sound', 199],
  ['toys', '🏎️', 'pink', 'Gebraucht', 'Carrera Digital 132 Grundpackung mit zwei Autos', 149],
  ['toys', '🧸', 'beige', 'Gebraucht', 'Steiff Teddybär mit Knopf im Ohr, 35 cm', 79],
  ['toys', '🚗', 'warm', 'Gebraucht', 'Bobby Car Classic rot', 25],
  ['toys', '🧩', 'mint', 'Neu', 'Ravensburger Puzzle 3000 Teile, eingeschweißt', 24],
  ['toys', '🪀', 'yellow', 'Gebraucht', 'BRIO Holzeisenbahn Set, 50 Teile', 49],
  ['toys', '🦖', 'green', 'Gebraucht', 'Schleich Dinosaurier Sammlung, 22 Figuren', 65],
  ['collect', '💿', 'purple', 'Gebraucht', 'The Beatles – Abbey Road LP, deutsche Erstpressung 1969', 89],
  ['collect', '🃏', 'orange', 'Gebraucht', 'Pokémon Glurak Holo 4/102 Base Set, leicht bespielt', 289],
  ['collect', '✉️', 'beige', 'Gebraucht', 'Briefmarken DDR 1949–1990 komplett postfrisch im Album', 349],
  ['collect', '🫖', 'blue', 'Gebraucht', 'Hutschenreuther Sammeltasse mit Unterteller, Goldrand', 9],
  ['collect', '🚙', 'mint', 'Gebraucht', 'Siku Modellauto Konvolut, 40 Stück, 70er/80er', 79],
  ['collect', '📚', 'yellow', 'Gebraucht', 'Lustiges Taschenbuch Nr. 1–50, gemischter Zustand', 119],
  ['collect', '🪙', 'beige', 'Gebraucht', '5 DM Silbermünzen Konvolut, 10 Stück', 95],
  ['collect', '📕', 'warm', 'Gebraucht', 'OTTO Versand Katalog Herbst/Winter 1985/86', 19],
  ['collect', '🐭', 'pink', 'Gebraucht', 'Diddl Blätter Sammlung, 120 Stück im Ordner', 39],
  ['collect', '🎞️', 'purple', 'Neu', 'Star Wars Trilogie VHS Box, Erstauflage, eingeschweißt', 59],
  ['outdoor', '🚲', 'green', 'Gebraucht', 'E-Bike Cube Reaction Hybrid 625 Wh, 2022, 1.800 km', 1690],
  ['outdoor', '⛺', 'mint', 'Gebraucht', 'Vaude Zelt 3 Personen, zweimal benutzt', 149],
  ['outdoor', '🛼', 'pink', 'Gebraucht', 'Rollschuhe Retro Gr. 39, pink/weiß', 35],
  ['outdoor', '🏓', 'blue', 'Gebraucht', 'Kettler Outdoor Tischtennisplatte, Selbstabholung', 219],
  ['outdoor', '🎣', 'beige', 'Gebraucht', 'Angelrute Shimano mit Rolle, Spinnrute 2,70 m', 59],
  ['outdoor', '🛹', 'yellow', 'Gebraucht', 'Longboard Komplett, 104 cm', 45],
  ['outdoor', '🏋️', 'orange', 'Gebraucht', 'Kurzhantel-Set 2 × 20 kg, Gusseisen', 49],
  ['outdoor', '🛶', 'blue', 'Gebraucht', 'Aufblasbares Kajak für 2 Personen mit Paddeln', 129],
  ['outdoor', '🏄', 'mint', 'Neu', 'SUP Board aufblasbar 320 cm Komplett-Set', 189],
  ['outdoor', '🥾', 'beige', 'Gebraucht', 'Meindl Wanderschuhe Gr. 43, Gore-Tex', 69],
  ['garden', '🪛', 'mint', 'Gebraucht', 'Makita DDF484 Akkuschrauber 18 V mit 2 Akkus', 149],
  ['garden', '🌱', 'green', 'Gebraucht', 'Honda HRG 416 Benzin-Rasenmäher, frisch gewartet', 229],
  ['garden', '🧙', 'warm', 'Gebraucht', 'Gartenzwerg aus Beton, 60 cm, handbemalt', 39],
  ['garden', '🧰', 'orange', 'Neu', 'Werkzeugkoffer 186-teilig, Chrom-Vanadium', 59],
  ['garden', '🔥', 'beige', 'Gebraucht', 'Weber Kugelgrill Master-Touch 57 cm schwarz', 169],
  ['garden', '🪴', 'green', 'Gebraucht', 'Teak Gartenstühle, 4 Stück, klappbar', 189],
  ['garden', '💦', 'blue', 'Gebraucht', 'Kärcher K4 Hochdruckreiniger mit Flächenreiniger', 119],
  ['garden', '🛒', 'yellow', 'Gebraucht', 'Schubkarre verzinkt 100 l', 35],
  ['garden', '🐦', 'beige', 'Neu', 'Vogelhaus aus Holz mit Ständer, 1,50 m', 45],
  ['odd', '🐶', 'beige', 'Gebraucht', 'Original Wackeldackel 70er Jahre, Hutablage', 29],
  ['odd', '🌋', 'orange', 'Gebraucht', 'Mathmos Lavalampe Astro rot/gelb', 79],
  ['odd', '❄️', 'blue', 'Neu', 'Schneekugel Hamburg mit Michel und Elbphilharmonie', 12],
  ['odd', '🦩', 'pink', 'Neu', 'Flamingo Gartenfigur 2er Set, Kunststoff, 80 cm', 19],
  ['odd', '🐟', 'mint', 'Gebraucht', 'Singender Fisch Big Mouth Billy Bass, funktioniert', 25],
  ['odd', '📞', 'warm', 'Gebraucht', 'Telefon FeTAp 611 Wählscheibe orange, Post', 49],
  ['odd', '🪩', 'purple', 'Gebraucht', 'Discokugel 40 cm mit Motor', 39],
  ['odd', '🦆', 'yellow', 'Neu', 'Badeenten Sammlung 100 Stück, alle verschieden', 79],
  ['odd', '🎅', 'warm', 'Gebraucht', 'Lebensgroßer Weihnachtsmann, beleuchtet, 1,80 m', 99],
];

/**
 * @typedef {object} Item
 * @property {string} id
 * @property {Theme} theme
 * @property {string} title
 * @property {string} condition
 * @property {string[]} images  photo URLs on our origin (/img/…); empty for demo items
 * @property {{ emoji: string, tint: Tint } | null} art  what shows instead of photos
 * @property {number} price  euros
 * @property {string | null} url  the listing, for the reveal
 */

/** @type {Item[]} */
export const MOCK_ITEMS = ROWS.map(([theme, emoji, tint, condition, title, price], i) => ({
  id: `demo:${i + 1}`,
  theme,
  title,
  condition,
  images: [],
  art: { emoji, tint },
  price,
  url: null,
}));

/**
 * @param {{ random?: () => number }} [options]
 */
export function createMockSource({ random = Math.random } = {}) {
  return {
    name: 'mock',
    demo: true,
    /**
     * `count` items for the given range and themes, none of them in `exclude`. Widens to every theme
     * and then to every price before it gives fewer than asked, so a game always fills up.
     * @param {{ count: number, price: import('./themes.mjs').PriceRange, themes: Theme[], exclude?: Set<string> }} request
     */
    async draw({ count, price, themes, exclude = new Set() }) {
      const [min, max] = PRICES[price];
      const fresh = MOCK_ITEMS.filter((item) => !exclude.has(item.id));
      const tiers = [
        fresh.filter((item) => themes.includes(item.theme) && item.price >= min && item.price <= max),
        fresh.filter((item) => item.price >= min && item.price <= max),
        fresh,
        MOCK_ITEMS,
      ];
      const picked = [];
      const taken = new Set();
      for (const tier of tiers) {
        for (const item of shuffle(tier, random)) {
          if (picked.length >= count) break;
          if (taken.has(item.id)) continue;
          taken.add(item.id);
          picked.push(item);
        }
      }
      return picked.map((item) => ({ ...item }));
    },
  };
}

/** Fisher–Yates on a copy. */
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
