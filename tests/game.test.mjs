import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_RANGES, cleanAvatar, cleanName, mergeSettings, DEFAULT_SETTINGS, CODE, GameError } from '../server/game.mjs';
import { createMockSource, MOCK_ITEMS } from '../server/items/mock.mjs';
import { seeded, setup, threePlayers, watch } from './helpers.mjs';
import { PRICES, THEME_KEYS } from '../server/items/themes.mjs';
import { score } from '../server/scoring.mjs';

test('a room has a four-letter code without vowels and its creator hosts it', () => {
  const { games } = setup();
  const { code, player, token } = games.create({ name: '  Anna  ' });
  assert.match(code, CODE);
  assert.ok(token.length >= 20);
  const view = games.view(code);
  assert.equal(view.host, player);
  assert.deepEqual(view.players.map((p) => p.name), ['Anna']);
  assert.equal(view.phase, 'lobby');
  assert.equal(view.demo, true);
  // The token never reaches the view.
  assert.ok(!JSON.stringify(view).includes(token));
});

test('names are cleaned, capped, and made unique within a room', () => {
  assert.equal(cleanName('  Eric \n  W.  '), 'Eric W.');
  assert.equal(cleanName('a\u0000b​c'), 'abc');
  assert.equal(cleanName('x'.repeat(40)).length, 16);
  assert.equal(cleanName('👩‍👩‍👧‍👦'.repeat(20)), '👩‍👩‍👧‍👦'.repeat(16));
  assert.equal(cleanName(42), '');
  const { games } = setup();
  const { code } = games.create({ name: 'Anna' });
  games.join(code, { name: 'anna' });
  games.join(code, { name: 'Anna' });
  assert.deepEqual(games.view(code).players.map((p) => p.name), ['Anna', 'anna 2', 'Anna 3']);
  assert.throws(() => games.join(code, { name: '   ' }), (e) => e instanceof GameError && e.code === 'name');
});

test('an avatar is a price tag, [pattern, figure], picked on joining and changed any time', async () => {
  assert.deepEqual(AVATAR_RANGES, [8, 23]);
  for (const ok of [[0, 0], [7, 22], [3, 5]]) assert.deepEqual(cleanAvatar(ok), ok);
  // Anything else: a random pattern with the name's initial.
  for (const no of [null, undefined, '3,5', [8, 0], [0, 23], [-1, 0], [1.5, 2], [1, 2, 3], [1], {}]) {
    const [pattern, figure] = cleanAvatar(no);
    assert.ok(Number.isInteger(pattern) && pattern >= 0 && pattern < 8, String(no));
    assert.equal(figure, 0, String(no));
  }
  const { games } = setup();
  const { code, token } = games.create({ name: 'Anna', avatar: [6, 3] });
  games.join(code, { name: 'Ben', avatar: 'a fox' });
  games.join(code, { name: 'Cem' });
  const players = games.view(code).players;
  assert.deepEqual(players[0].avatar, [6, 3]);
  assert.equal(players[1].avatar[1], 0);
  assert.equal(players[2].avatar[1], 0);
  await games.act(code, token, 'avatar', { avatar: [2, 19] });
  assert.deepEqual(games.view(code).players[0].avatar, [2, 19]);
  // A bad change is refused and the old one stays.
  await assert.rejects(games.act(code, token, 'avatar', { avatar: [2, 99] }), { code: 'avatar' });
  assert.deepEqual(games.view(code).players[0].avatar, [2, 19]);
});

test('a known token gets the same seat back', () => {
  const { games } = setup();
  const { code } = games.create({ name: 'Anna' });
  const ben = games.join(code, { name: 'Ben' });
  const again = games.join(code.toLowerCase(), { name: 'Somebody else', token: ben.token });
  assert.equal(again.player, ben.player);
  assert.equal(games.view(code).players.length, 2);
  // A token on its own is only ever a way back to that seat.
  assert.equal(games.join(code, { token: ben.token }).player, ben.player);
  assert.throws(() => games.join(code, { token: 'stale' }), (e) => e instanceof GameError && e.code === 'no-player');
  assert.equal(games.view(code).players.length, 2);
});

test('only the host changes settings, and only to allowed values', async () => {
  const { games, host, ben } = await threePlayers();
  await assert.rejects(games.act(host.code, ben.token, 'settings', { rounds: 5 }), { code: 'not-host' });
  await games.act(host.code, host.token, 'settings', { rounds: 5, seconds: 7, price: 'small', themes: ['toys', 'nope'], showTitle: false });
  const { settings } = games.view(host.code);
  assert.equal(settings.rounds, 5);
  assert.equal(settings.seconds, DEFAULT_SETTINGS.seconds);
  assert.equal(settings.price, 'small');
  assert.deepEqual(settings.themes, ['toys']);
  assert.equal(settings.showTitle, false);
  // Any selection is kept, even none; the game just won't start without one.
  assert.deepEqual(mergeSettings(settings, { themes: ['odd', 'tech'] }).themes, ['tech', 'odd']);
  assert.deepEqual(mergeSettings(settings, { themes: [] }).themes, []);
  assert.equal(mergeSettings(settings, { jokers: 3 }).jokers, 3);
  assert.equal(mergeSettings(settings, { jokers: 9 }).jokers, DEFAULT_SETTINGS.jokers);
  await games.act(host.code, host.token, 'settings', { themes: [] });
  await assert.rejects(games.act(host.code, host.token, 'start'), { code: 'no-themes' });
  assert.equal(games.view(host.code).phase, 'lobby');
});

test('a joker scores the maximum without a guess, and only as often as the host allows', async () => {
  const { games, clock, host, ben, cem } = await threePlayers({ rounds: 5, jokers: 1 });
  const code = host.code;
  await games.act(code, host.token, 'start');
  assert.deepEqual(games.view(code).players.map((p) => p.jokers), [1, 1, 1]);

  await games.act(code, ben.token, 'joker');
  let view = games.view(code);
  // Until the reveal a joker looks like any other guess.
  assert.equal(view.players.find((p) => p.id === ben.player).guessed, true);
  assert.equal(view.players.find((p) => p.id === ben.player).jokers, 0);
  await assert.rejects(games.act(code, ben.token, 'guess', { value: 5 }), { code: 'already-guessed' });
  await assert.rejects(games.act(code, ben.token, 'joker'), { code: 'already-guessed' });

  const price = MOCK_ITEMS.find((i) => i.id === view.round.item.id).price;
  await games.act(code, host.token, 'guess', { value: price * 1.1 });
  await games.act(code, cem.token, 'guess', { value: price });
  clock.advance(1000);
  view = games.view(code);
  assert.equal(view.phase, 'reveal');
  const ben1 = view.reveal.results.find((r) => r.player === ben.player);
  assert.deepEqual([ben1.joker, ben1.guess, ben1.points], [true, null, 1000]);
  // At equal points the real bullseye ranks first, and "closest" is a real guess.
  assert.deepEqual(view.reveal.results.map((r) => r.player), [cem.player, ben.player, host.player]);

  await games.act(code, host.token, 'next');
  await assert.rejects(games.act(code, ben.token, 'joker'), { code: 'no-jokers' });

  // A joker on an item the host skips goes back to its player.
  await games.act(code, cem.token, 'joker');
  await games.act(code, host.token, 'skip');
  assert.equal(games.view(code).players.find((p) => p.id === cem.player).jokers, 1);

  // Nobody guessing but a joker still ends the round early.
  await games.act(code, host.token, 'joker');
  await games.act(code, ben.token, 'guess', { value: 1 });
  await games.act(code, cem.token, 'guess', { value: 1 });
  clock.advance(1000);
  view = games.view(code);
  assert.equal(view.phase, 'reveal');
  assert.deepEqual([view.reveal.results[0].player, view.reveal.results[0].joker], [host.player, true]);
  // The round's "closest" in the final recap is a real guess, never the joker.
  for (let n = 3; n <= 5; n++) {
    await games.act(code, host.token, 'next');
    clock.advance(31_000);
  }
  await games.act(code, host.token, 'next');
  const recap = games.view(code).history.find((h) => h.n === 2);
  assert.notEqual(recap.best?.player, host.player);
});

test('jokers can be switched off, and a rematch refills them', async () => {
  const { games, clock, host, ben } = await threePlayers({ rounds: 5, jokers: 0 });
  await games.act(host.code, host.token, 'start');
  await assert.rejects(games.act(host.code, ben.token, 'joker'), { code: 'no-jokers' });
  for (let n = 1; n <= 5; n++) {
    clock.advance(31_000);
    await games.act(host.code, host.token, 'next');
  }
  await games.act(host.code, host.token, 'settings', { jokers: 2 });
  await games.act(host.code, host.token, 'rematch');
  await games.act(host.code, host.token, 'settings', { jokers: 2 });
  assert.equal(games.view(host.code).settings.jokers, 2);
  await games.act(host.code, host.token, 'start');
  assert.deepEqual(games.view(host.code).players.map((p) => p.jokers), [2, 2, 2]);
});

test('a whole game: guesses, early reveal, scores, final, rematch', async () => {
  const { games, clock, host, ben, cem, pages } = await threePlayers({ rounds: 5, seconds: 30 });
  const code = host.code;
  await games.act(code, host.token, 'start');
  let view = games.view(code);
  assert.equal(view.phase, 'guess');
  assert.equal(view.round.n, 1);
  assert.equal(view.round.total, 5);
  assert.equal(view.round.endsAt, clock.now() + 30_000);
  // During the round nobody sees the price.
  assert.equal(view.reveal, null);
  assert.ok(!('price' in view.round.item));

  const price = MOCK_ITEMS.find((i) => i.id === view.round.item.id).price;
  await games.act(code, host.token, 'guess', { value: price });
  await games.act(code, ben.token, 'guess', { value: price * 1.5 });
  await assert.rejects(games.act(code, ben.token, 'guess', { value: 1 }), { code: 'already-guessed' });
  assert.deepEqual(games.view(code).players.map((p) => p.guessed), [true, true, false]);
  await games.act(code, cem.token, 'guess', { value: price * 4 });

  // Everyone's in: the reveal follows after a beat, not at the end of the timer.
  assert.equal(games.view(code).phase, 'guess');
  clock.advance(1000);
  view = games.view(code);
  assert.equal(view.phase, 'reveal');
  assert.equal(view.reveal.price, price);
  assert.deepEqual(
    view.reveal.results.map((r) => [r.player, r.points]),
    [
      [host.player, 1000],
      [ben.player, score(price * 1.5, price)],
      [cem.player, 0],
    ],
  );
  assert.equal(view.reveal.results[0].bullseye, true);
  assert.equal(pages[1].view.phase, 'reveal');

  await assert.rejects(games.act(code, ben.token, 'next'), { code: 'not-host' });
  for (let n = 2; n <= 5; n++) {
    await games.act(code, host.token, 'next');
    assert.equal(games.view(code).round.n, n);
    // Nobody guesses: the timer ends the round, and missing guesses score 0.
    clock.advance(30_000);
    assert.equal(games.view(code).phase, 'reveal');
  }
  await games.act(code, host.token, 'next');
  view = games.view(code);
  assert.equal(view.phase, 'final');
  assert.equal(view.history.length, 5);
  assert.equal(view.players.find((p) => p.id === host.player).score, 1000);
  assert.equal(view.history[0].best.player, host.player);

  await games.act(code, host.token, 'rematch');
  view = games.view(code);
  assert.equal(view.phase, 'lobby');
  assert.deepEqual(view.players.map((p) => p.score), [0, 0, 0]);

  // A rematch draws items it hasn't shown yet.
  const before = new Set(games.view(code).history.map((h) => h.title));
  await games.act(code, host.token, 'start');
  assert.ok(!before.has(games.view(code).round.item.title));
});

test('the timer ends a round even when people are missing', async () => {
  const { games, clock, host, ben } = await threePlayers({ seconds: 20 });
  await games.act(host.code, host.token, 'start');
  await games.act(host.code, ben.token, 'guess', { value: 10 });
  clock.advance(19_000);
  assert.equal(games.view(host.code).phase, 'guess');
  clock.advance(1_000);
  const { reveal } = games.view(host.code);
  assert.equal(reveal.results.filter((r) => r.guess === null).length, 2);
});

test('someone offline does not hold up the reveal', async () => {
  const { games, clock, host, ben, pages } = await threePlayers();
  await games.act(host.code, host.token, 'start');
  pages[2].off();
  await games.act(host.code, host.token, 'guess', { value: 10 });
  await games.act(host.code, ben.token, 'guess', { value: 20 });
  clock.advance(1000);
  assert.equal(games.view(host.code).phase, 'reveal');
});

test('guesses are validated and kept to the cent', async () => {
  const { games, clock, host } = await threePlayers();
  await games.act(host.code, host.token, 'start');
  for (const value of [0, -5, 'abc', null, 1e9, Infinity]) {
    await assert.rejects(games.act(host.code, host.token, 'guess', { value }), { code: 'guess' }, String(value));
  }
  await games.act(host.code, host.token, 'guess', { value: '12.345' });
  clock.advance(60_000);
  assert.equal(games.view(host.code).reveal.results.find((r) => r.player === host.player).guess, 12.35);
});

test('the host can skip an item; the round starts over with a spare', async () => {
  const { games, clock, host, ben } = await threePlayers({ rounds: 5 });
  await games.act(host.code, host.token, 'start');
  const first = games.view(host.code).round;
  await games.act(host.code, ben.token, 'guess', { value: 5 });
  clock.advance(10_000);
  await assert.rejects(games.act(host.code, ben.token, 'skip'), { code: 'not-host' });
  await games.act(host.code, host.token, 'skip');
  const second = games.view(host.code).round;
  assert.equal(second.n, 1);
  assert.notEqual(second.item.id, first.item.id);
  assert.equal(second.skips, first.skips - 1);
  assert.equal(second.endsAt, clock.now() + 30_000);
  assert.ok(games.view(host.code).players.every((p) => !p.guessed));
});

test('the title can be hidden until the reveal', async () => {
  const { games, clock, host } = await threePlayers({ showTitle: false });
  await games.act(host.code, host.token, 'start');
  assert.equal(games.view(host.code).round.item.title, null);
  clock.advance(60_000);
  assert.equal(typeof games.view(host.code).round.item.title, 'string');
});

test("the host's seat passes on after they've been gone a while, and back is not automatic", async () => {
  const { games, clock, host, ben, pages } = await threePlayers();
  pages[0].off();
  clock.advance(10_000);
  games.tick();
  assert.equal(games.view(host.code).host, host.player);
  clock.advance(6_000);
  games.tick();
  assert.equal(games.view(host.code).host, ben.player);
  watch(games, host.code, host.player);
  assert.equal(games.view(host.code).host, ben.player);
});

test('people who closed the page leave the lobby after a minute; in a game they stay', async () => {
  const { games, clock, host, pages } = await threePlayers();
  pages[2].off();
  clock.advance(61_000);
  games.tick();
  assert.equal(games.view(host.code).players.length, 2);

  const second = await threePlayers();
  await second.games.act(second.host.code, second.host.token, 'start');
  second.pages[2].off();
  second.clock.advance(61_000);
  second.games.tick();
  assert.equal(second.games.view(second.host.code).players.length, 3);
});

test('leaving, kicking, and the last one out closes the room', async () => {
  const { games, host, ben, cem, pages } = await threePlayers();
  await games.act(host.code, host.token, 'kick', { player: cem.player });
  assert.equal(games.view(host.code).players.length, 2);
  await assert.rejects(games.act(host.code, cem.token, 'guess', { value: 1 }), { code: 'no-player' });
  await games.act(host.code, host.token, 'leave');
  assert.equal(games.view(host.code).host, ben.player);
  await games.act(host.code, ben.token, 'leave');
  assert.equal(games.info(host.code), null);
  assert.equal(pages[1].view.phase, 'gone');
});

test('empty rooms are forgotten', () => {
  const { games, clock } = setup();
  const { code } = games.create({ name: 'Anna' });
  clock.advance(31 * 60_000);
  games.tick();
  assert.equal(games.info(code), null);
});

test("a source that fails puts the room back in the lobby with a notice", async () => {
  const failing = { name: 'ebay', demo: false, draw: async () => Promise.reject(Object.assign(new Error('x'), { code: 'quota' })) };
  const { games } = setup({ source: failing });
  const { code, token } = games.create({ name: 'Anna' });
  await games.act(code, token, 'start');
  const view = games.view(code);
  assert.equal(view.phase, 'lobby');
  assert.equal(view.notice, 'items-failed:quota');
  assert.equal(view.demo, false);
});

test('the demo list fills every price range and theme with plausible items', async () => {
  for (const item of MOCK_ITEMS) {
    assert.ok(THEME_KEYS.includes(item.theme), item.title);
    assert.ok(item.price > 0 && Number.isFinite(item.price), item.title);
    assert.ok(item.title.length > 8, item.title);
    assert.ok(item.art.emoji, item.title);
  }
  const source = createMockSource({ random: seeded(3) });
  for (const price of Object.keys(PRICES)) {
    const items = await source.draw({ count: 19, price, themes: THEME_KEYS, exclude: new Set() });
    assert.equal(items.length, 19, price);
    const [min, max] = PRICES[price];
    assert.ok(items.every((i) => i.price >= min && i.price <= max), price);
    assert.equal(new Set(items.map((i) => i.id)).size, 19);
  }
  // A narrow pick still fills a game, widening past the themes.
  const narrow = await source.draw({ count: 19, price: 'small', themes: ['odd'], exclude: new Set() });
  assert.equal(narrow.length, 19);
});
