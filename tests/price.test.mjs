import { test } from 'node:test';
import assert from 'node:assert/strict';
// Node runs the TypeScript sources directly (type stripping, Node 24).
import { formatDeviation, formatPrice, parsePrice, priceChars } from '../src/lib/price.ts';

test('prices read the way people type them, in German or English', () => {
  const cases = {
    '120': 120,
    '120€': 120,
    '120 €': 120,
    '120 EUR': 120,
    '12,50': 12.5,
    '12.50': 12.5,
    '12,5': 12.5,
    '1.250': 1250,
    '1.250,99': 1250.99,
    '1,250.99': 1250.99,
    '1.250.000': 1250000,
    '1,250,000': 1250000,
    ',99': 0.99,
    '0,10': 0.1,
    '12,345': 12.35,
  };
  for (const [text, value] of Object.entries(cases)) assert.equal(parsePrice(text), value, text);
});

test('the guess field keeps digits, commas and dots only', () => {
  assert.equal(priceChars('12,50'), '12,50');
  assert.equal(priceChars('1.249,99'), '1.249,99');
  assert.equal(priceChars('12abc,5 €x'), '12,5');
  assert.equal(priceChars('-3e5'), '35');
  assert.equal(priceChars('zwölf'), '');
});

test('anything else is not a price', () => {
  for (const text of ['', 'abc', '0', '0,00', '-5', '1.2.3', '12a', '€', '1e5']) assert.equal(parsePrice(text), null, text);
});

test('prices show as 5,80€ in both languages, without cents when there are none', () => {
  assert.equal(formatPrice(389), '389€');
  assert.equal(formatPrice(5.8), '5,80€');
  assert.equal(formatPrice(1249.99), '1.249,99€');
  assert.equal(formatPrice(10900), '10.900€');
});

test('deviations carry a sign and the language’s spacing', () => {
  assert.equal(formatDeviation(0.12, 'de'), '+12 %');
  assert.equal(formatDeviation(-0.3, 'en'), '−30%');
  assert.equal(formatDeviation(0.003, 'de'), '+0,3 %');
  assert.equal(formatDeviation(0, 'en'), '±0%');
});
