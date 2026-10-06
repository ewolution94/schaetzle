import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, deviation, bullseye } from '../server/scoring.mjs';

test('an exact guess scores 1000, half or double scores nothing', () => {
  assert.equal(score(100, 100), 1000);
  assert.equal(score(200, 100), 0);
  assert.equal(score(50, 100), 0);
  assert.equal(score(5000, 100), 0);
  assert.equal(score(0.01, 100), 0);
});

test('too high and too low by the same factor score the same', () => {
  for (const factor of [1.1, 1.25, 1.5, 1.9]) {
    assert.equal(score(100 * factor, 100), score(100 / factor, 100), String(factor));
  }
  assert.equal(score(110, 100), 862);
  assert.equal(score(90, 100), 848);
  assert.equal(score(125, 100), 678);
});

test('closer is never worse', () => {
  let last = 1000;
  for (let guess = 100; guess <= 220; guess += 3) {
    const points = score(guess, 100);
    assert.ok(points <= last, `${guess}: ${points} > ${last}`);
    last = points;
  }
});

test('nonsense scores nothing', () => {
  for (const guess of [0, -1, NaN, undefined]) assert.equal(score(guess, 100), 0);
  assert.equal(score(10, 0), 0);
});

test('deviation and bullseye', () => {
  assert.equal(deviation(110, 100).toFixed(2), '0.10');
  assert.equal(deviation(50, 100), -0.5);
  assert.equal(bullseye(101.9, 100), true);
  assert.equal(bullseye(97.9, 100), false);
});
