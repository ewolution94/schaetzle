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
