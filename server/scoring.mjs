// How a guess scores. Prices are multiplicative (a 20 € guess for a 10 € item is as far off as
// 200 € for 100 €), so the score looks at the ratio, not the difference: guessing double the
// price scores the same as guessing half, and both score nothing.
//
//   points = 1000 × (1 − |log₂(guess / price)|), at least 0
//
// 10 % too high ≈ 862, 10 % too low ≈ 848, 25 % off ≈ 678, half or double = 0. Speed doesn't count.

export const MAX_POINTS = 1000;

/** Within this share of the price, a guess is a "bullseye" (a badge; the points stay the formula's). */
export const BULLSEYE = 0.02;

/** @param {number} guess  @param {number} price  @returns {number} whole points, 0–1000 */
export function score(guess, price) {
  if (!(guess > 0) || !(price > 0)) return 0;
  const off = Math.abs(Math.log2(guess / price));
  return Math.max(0, Math.round(MAX_POINTS * (1 - off)));
}

/** How far off a guess is, as a signed share of the price: 0.1 is 10 % too high. */
export function deviation(guess, price) {
  return guess / price - 1;
}

export function bullseye(guess, price) {
  return Math.abs(deviation(guess, price)) <= BULLSEYE;
}

// ---- the other modes ------------------------------------------------------------------------

/**
 * "Der Preis ist heiß": the same ratio, but a guess over the price scores nothing.
 * @param {number} guess  @param {number} price
 */
export function scoreUnder(guess, price) {
  return guess > price ? 0 : score(guess, price);
}

/**
 * Higher or lower: is this item dearer or cheaper than the last one? Right scores 500, plus up to
 * 500 more the closer the two prices are (a call between 40 € and 44 € is harder than between
 * 40 € and 400 €); prices 8× apart or more add nothing. Wrong scores 0. Equal prices: both are right.
 *
 *   points = 500 + 500 × max(0, 1 − |log₂(price / anchor)| / 3)
 *
 * @param {'higher' | 'lower'} pick  @param {number} anchor  the last item's price  @param {number} price
 */
export function scorePick(pick, anchor, price) {
  if (!(anchor > 0) || !(price > 0)) return 0;
  const right = price === anchor || (pick === 'higher') === price > anchor;
  if (!right) return 0;
  const apart = Math.abs(Math.log2(price / anchor));
  return Math.round(MAX_POINTS / 2 + (MAX_POINTS / 2) * Math.max(0, 1 - apart / 3));
}

/**
 * Sorting: four items from cheapest to dearest. Each of the six pairs in the right order is a
 * sixth of the points, so one swap of neighbours still scores 833. Equal prices count either way.
 *
 * @param {string[]} order  item ids, cheapest first, as the player put them
 * @param {Map<string, number>} prices  item id → price
 * @returns {{ pairs: number, of: number, points: number }}
 */
export function scoreOrder(order, prices) {
  let pairs = 0;
  let of = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      of++;
      if (prices.get(order[i]) <= prices.get(order[j])) pairs++;
    }
  }
  return { pairs, of, points: of ? Math.round((MAX_POINTS * pairs) / of) : 0 };
}
