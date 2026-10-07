import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainItems, dealItems, groupItems, mergeSettings, DEFAULT_SETTINGS } from '../server/game.mjs';
import { MOCK_ITEMS } from '../server/items/mock.mjs';
import { scoreOrder, scorePick, scoreUnder, score } from '../server/scoring.mjs';
import { setup, threePlayers } from './helpers.mjs';

const priceOf = (id) => MOCK_ITEMS.find((item) => item.id === id).price;
const apart = (a, b) => Math.max(a, b) / Math.min(a, b) >= 1.1;

/** Plays the rest of a game with nobody guessing, to the final. */
async function finish(games, clock, host) {
  for (;;) {
    const view = games.view(host.code);
    if (view.phase === 'final') return view;
    if (view.phase === 'guess') clock.advance(91_000);
    await games.act(host.code, host.token, 'next');
  }
}

// ---- scoring ---------------------------------------------------------------------------------

test('Der Preis ist heiß: over the price scores nothing, under scores like the classic game', () => {
  assert.equal(scoreUnder(100, 100), 1000);
  assert.equal(scoreUnder(100.01, 100), 0);
  assert.equal(scoreUnder(500, 100), 0);
  assert.equal(scoreUnder(80, 100), score(80, 100));
  assert.equal(scoreUnder(50, 100), 0);
});

test('higher or lower: right scores 500 to 1,000, more for a closer call; wrong scores 0', () => {
  // Ten times the price is an easy call: the 500 alone.
  assert.equal(scorePick('higher', 40, 400), 500);
  assert.equal(scorePick('lower', 40, 400), 0);
  assert.ok(scorePick('lower', 44, 40) > scorePick('lower', 80, 40));
  assert.ok(scorePick('lower', 44, 40) <= 1000);
  assert.equal(scorePick('higher', 50, 100), Math.round(500 + 500 * (2 / 3)));
  // Equal prices: either answer is right.
  assert.equal(scorePick('higher', 30, 30), 1000);
  assert.equal(scorePick('lower', 30, 30), 1000);
  assert.equal(scorePick('higher', 0, 30), 0);
});

test('sorting scores each pair in the right order', () => {
  const prices = new Map([
    ['a', 5],
    ['b', 20],
    ['c', 90],
    ['d', 400],
  ]);
  assert.deepEqual(scoreOrder(['a', 'b', 'c', 'd'], prices), { pairs: 6, of: 6, points: 1000 });
  assert.deepEqual(scoreOrder(['b', 'a', 'c', 'd'], prices), { pairs: 5, of: 6, points: 833 });
  assert.deepEqual(scoreOrder(['d', 'c', 'b', 'a'], prices), { pairs: 0, of: 6, points: 0 });
  // Equal prices count either way.
  assert.equal(scoreOrder(['x', 'y'], new Map([['x', 10], ['y', 10]])).points, 1000);
});

// ---- dealing ---------------------------------------------------------------------------------

test('higher or lower deals a chain whose neighbours are at least 10 % apart', () => {
  const { chain } = chainItems(MOCK_ITEMS);
  assert.ok(chain.length > 80);
  for (let i = 1; i < chain.length; i++) assert.ok(apart(chain[i].price, chain[i - 1].price));
  const deal = dealItems('higher', MOCK_ITEMS.slice(0, 20), 10);
  assert.equal(deal.queue.length, 10);
  assert.ok(apart(deal.anchor.price, deal.queue[0].price));
  // Too few items for even one round.
  assert.equal(dealItems('higher', [MOCK_ITEMS[0]], 10), null);
});

test('sorting deals groups of four with no two prices within 10 %', () => {
  const groups = groupItems(MOCK_ITEMS, 4);
  assert.ok(groups.length >= 20);
  for (const group of groups) {
    assert.equal(group.length, 4);
    for (const a of group) for (const b of group) if (a !== b) assert.ok(apart(a.price, b.price));
  }
  const deal = dealItems('sort', MOCK_ITEMS.slice(0, 18), 10);
  // Eighteen items make at most four rounds; a short game, not a broken one.
  assert.ok(deal.queue.length >= 2 && deal.queue.length <= 4);
  assert.equal(dealItems('sort', MOCK_ITEMS.slice(0, 3), 10), null);
});

test('switching to sorting lifts a short timer, unless the same change sets one', () => {
  const s = { ...DEFAULT_SETTINGS, seconds: 30 };
  assert.equal(mergeSettings(s, { mode: 'sort' }).seconds, 60);
  assert.equal(mergeSettings(s, { mode: 'sort', seconds: 20 }).seconds, 20);
  assert.equal(mergeSettings({ ...s, seconds: 90 }, { mode: 'sort' }).seconds, 90);
  assert.equal(mergeSettings(s, { mode: 'hot' }).seconds, 30);
  assert.equal(mergeSettings(s, { mode: 'poker' }).mode, 'classic');
  assert.equal(mergeSettings(s, { teams: 3 }).teams, 3);
  assert.equal(mergeSettings(s, { teams: 1 }).teams, 0);
});

// ---- the modes in play -----------------------------------------------------------------------

test('Der Preis ist heiß: a guess over the price scores 0 and is never the closest', async () => {
  const { games, clock, host, ben, cem } = await threePlayers({ mode: 'hot', rounds: 5 });
  await games.act(host.code, host.token, 'start');
  const view = games.view(host.code);
  assert.equal(view.round.mode, 'hot');
  const price = priceOf(view.round.item.id);
  await games.act(host.code, host.token, 'guess', { value: price * 1.01 });
  await games.act(host.code, ben.token, 'guess', { value: price * 0.7 });
  await games.act(host.code, cem.token, 'guess', { value: price * 3 });
  clock.advance(1000);
  const { results } = games.view(host.code).reveal;
  const by = Object.fromEntries(results.map((r) => [r.player, r]));
  assert.deepEqual([by[host.player].points, by[host.player].over, by[host.player].bullseye], [0, true, false]);
  assert.equal(by[ben.player].points, score(price * 0.7, price));
  assert.equal(by[ben.player].over, false);
  assert.equal(results[0].player, ben.player);
  const final = await finish(games, clock, host);
  assert.equal(final.history[0].best.player, ben.player);
  assert.equal(final.game.mode, 'hot');
});

test('higher or lower: the last item is the one to beat, and only its price shows', async () => {
  const { games, clock, host, ben, cem } = await threePlayers({ mode: 'higher', rounds: 5 });
  await games.act(host.code, host.token, 'start');
  let view = games.view(host.code);
  const { item, anchor } = view.round;
  assert.ok(!('price' in item));
  assert.equal(anchor.price, priceOf(anchor.id));
  assert.ok(anchor.title);
  const price = priceOf(item.id);
  const right = price > anchor.price ? 'higher' : 'lower';
  const wrong = right === 'higher' ? 'lower' : 'higher';

  await assert.rejects(games.act(host.code, ben.token, 'guess', { value: 12 }), { code: 'guess' });
  await games.act(host.code, host.token, 'guess', { pick: right });
  await games.act(host.code, ben.token, 'guess', { pick: wrong });
  await games.act(host.code, cem.token, 'joker');
  clock.advance(1000);
  view = games.view(host.code);
  assert.equal(view.reveal.price, price);
  const by = Object.fromEntries(view.reveal.results.map((r) => [r.player, r]));
  assert.deepEqual([by[host.player].right, by[host.player].points], [true, scorePick(right, anchor.price, price)]);
  assert.deepEqual([by[ben.player].right, by[ben.player].points], [false, 0]);
  assert.equal(by[cem.player].points, 1000);

  // The next round's item to beat is this round's item, price and all.
  await games.act(host.code, host.token, 'next');
  view = games.view(host.code);
  assert.equal(view.round.anchor.id, item.id);
  assert.equal(view.round.anchor.price, price);

  // A skip keeps the item to beat and brings one far enough from it.
  await games.act(host.code, host.token, 'skip');
  const skipped = games.view(host.code).round;
  assert.equal(skipped.anchor.id, item.id);
  assert.notEqual(skipped.item.id, view.round.item.id);
  assert.ok(apart(priceOf(skipped.item.id), price));

  const final = await finish(games, clock, host);
  assert.deepEqual([final.history[0].anchor, final.history[0].right, final.history[0].picks, final.history[0].best], [anchor.price, 1, 2, null]);
});

test('sorting: four items without prices, an order of all four, and points per pair', async () => {
  const { games, clock, host, ben, cem } = await threePlayers({ mode: 'sort', rounds: 5 });
  assert.equal(games.view(host.code).settings.seconds, 60);
  await games.act(host.code, host.token, 'start');
  let view = games.view(host.code);
  assert.equal(view.round.item, null);
  assert.equal(view.round.items.length, 4);
  assert.equal(view.round.endsAt, clock.now() + 60_000);
  for (const item of view.round.items) assert.ok(!('price' in item));
  const ids = view.round.items.map((item) => item.id);
  const truth = [...ids].sort((a, b) => priceOf(a) - priceOf(b));

  await assert.rejects(games.act(host.code, host.token, 'guess', { order: ids.slice(0, 3) }), { code: 'guess' });
  await assert.rejects(games.act(host.code, host.token, 'guess', { order: [ids[0], ids[0], ids[1], ids[2]] }), { code: 'guess' });
  await assert.rejects(games.act(host.code, host.token, 'guess', { order: [...ids.slice(0, 3), 'demo:999'] }), { code: 'guess' });
  await games.act(host.code, host.token, 'guess', { order: truth });
  await games.act(host.code, ben.token, 'guess', { order: [truth[1], truth[0], truth[2], truth[3]] });
  await games.act(host.code, cem.token, 'guess', { order: [...truth].reverse() });
  clock.advance(1000);
  view = games.view(host.code);
  assert.deepEqual(view.reveal.items.map((x) => x.id), truth);
  assert.deepEqual(view.reveal.items.map((x) => x.price), truth.map(priceOf));
  assert.deepEqual(
    view.reveal.results.map((r) => [r.player, r.pairs, r.points]),
    [
      [host.player, 6, 1000],
      [ben.player, 5, 833],
      [cem.player, 0, 0],
    ],
  );

  // A skip deals four new items.
  await games.act(host.code, host.token, 'next');
  const before = games.view(host.code).round.items.map((x) => x.id);
  await games.act(host.code, host.token, 'skip');
  const after = games.view(host.code).round.items.map((x) => x.id);
  assert.equal(after.length, 4);
  assert.ok(after.every((id) => !before.includes(id)));

  const final = await finish(games, clock, host);
  assert.equal(final.history[0].items.length, 4);
  assert.deepEqual(final.history[0].items.map((x) => x.price), truth.map(priceOf));
  assert.deepEqual([final.history[0].best.player, final.history[0].best.pairs], [host.player, 6]);
});

// ---- teams -----------------------------------------------------------------------------------

test('teams: everyone is spread in turn, newcomers join the smallest, anyone can switch in the lobby', async () => {
  const { games, host, ben, cem } = await threePlayers();
  assert.deepEqual(games.view(host.code).players.map((p) => p.team), [null, null, null]);
  await games.act(host.code, host.token, 'settings', { teams: 2 });
  assert.deepEqual(games.view(host.code).players.map((p) => p.team), [0, 1, 0]);
  const dora = games.join(host.code, { name: 'Dora' });
  assert.equal(games.view(host.code).players.find((p) => p.id === dora.player).team, 1);

  await games.act(host.code, cem.token, 'team', { team: 1 });
  assert.equal(games.view(host.code).players.find((p) => p.id === cem.player).team, 1);
  await assert.rejects(games.act(host.code, cem.token, 'team', { team: 2 }), { code: 'team' });
  await assert.rejects(games.act(host.code, ben.token, 'shuffle'), { code: 'not-host' });

  await games.act(host.code, host.token, 'shuffle');
  const sizes = [0, 0];
  for (const p of games.view(host.code).players) sizes[p.team]++;
  assert.deepEqual(sizes, [2, 2]);

  await games.act(host.code, host.token, 'settings', { teams: 0 });
  assert.deepEqual(games.view(host.code).players.map((p) => p.team), [null, null, null, null]);
  await assert.rejects(games.act(host.code, cem.token, 'team', { team: 0 }), { code: 'team' });
});

test('teams score their members’ average each round, and keep their results until the rematch', async () => {
  const { games, clock, host, ben, cem } = await threePlayers({ rounds: 5, teams: 2 });
  // Anna and Cem against Ben.
  await games.act(host.code, host.token, 'start');
  let view = games.view(host.code);
  assert.deepEqual(view.game, { mode: 'classic', teams: 2 });
  assert.deepEqual(view.teams, [0, 0]);
  const price = priceOf(view.round.item.id);
  await games.act(host.code, host.token, 'guess', { value: price });
  await games.act(host.code, cem.token, 'guess', { value: price * 2 });
  await games.act(host.code, ben.token, 'guess', { value: price * 1.25 });
  clock.advance(1000);
  view = games.view(host.code);
  const benPoints = score(price * 1.25, price);
  assert.deepEqual(view.reveal.teams, [500, benPoints]);
  assert.deepEqual(view.teams, [500, benPoints]);

  // Changing teams after a game waits for the rematch; the results stay as they were.
  const final = await finish(games, clock, host);
  assert.deepEqual(final.teams, [500, benPoints]);
  await games.act(host.code, host.token, 'settings', { teams: 3 });
  assert.deepEqual(games.view(host.code).players.map((p) => p.team), [0, 1, 0]);
  assert.deepEqual(games.view(host.code).game.teams, 2);
  await games.act(host.code, host.token, 'rematch');
  view = games.view(host.code);
  assert.deepEqual(view.players.map((p) => p.team), [0, 1, 2]);
  assert.equal(view.game, null);
  assert.equal(view.teams, null);
});

test('no mode lets a price into the view before the reveal', async () => {
  for (const mode of ['classic', 'hot', 'higher', 'sort']) {
    const { games, host } = await threePlayers({ mode });
    await games.act(host.code, host.token, 'start');
    const { round, reveal } = games.view(host.code);
    assert.equal(reveal, null);
    for (const item of [round.item, ...(round.items ?? [])].filter(Boolean)) {
      assert.deepEqual(Object.keys(item).sort(), ['art', 'condition', 'id', 'images', 'theme', 'title'], mode);
    }
  }
});

test('a source with too few items for the mode puts the room back in the lobby', async () => {
  const source = { name: 'tiny', demo: true, draw: async () => MOCK_ITEMS.slice(0, 3) };
  const { games } = setup({ source });
  const host = games.create({ name: 'Anna' });
  await games.act(host.code, host.token, 'settings', { mode: 'sort' });
  await games.act(host.code, host.token, 'start');
  const view = games.view(host.code);
  assert.equal(view.phase, 'lobby');
  assert.equal(view.notice, 'items-failed:empty');
});
