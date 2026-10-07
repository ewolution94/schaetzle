// The game: rooms, players, rounds and the clock. No I/O: the HTTP layer (server/api.mjs) calls
// these functions and streams each room's view to its players; tests drive it with a fake clock.
//
// A room lives in memory only. A restart (a deploy) ends every game, and an empty room is
// forgotten after half an hour.
//
// Phases: lobby → loading (drawing items) → guess ⇄ reveal → final → (rematch) lobby.
//
// Modes (settings.mode) change what's on the table and what a guess is: one item and a price
// (classic, hot), one item and the last one's price to beat (higher), or four items to put in
// order (sort). Teams (settings.teams) work with every mode.

import { randomBytes, randomInt } from 'node:crypto';
import { MAX_POINTS, bullseye, deviation, score, scoreOrder, scorePick, scoreUnder } from './scoring.mjs';
import { THEME_KEYS, isPriceRange, isTheme } from './items/themes.mjs';

/** Room codes have no vowels, so no code spells a word. */
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;

export const ROUND_CHOICES = [5, 10, 15];
export const SECOND_CHOICES = [20, 30, 45, 60, 90];
/**
 * How a round is played:
 *   classic  guess the price; the ratio scores (scoring.mjs → score)
 *   hot      "Der Preis ist heiß": the same, but a guess over the price scores nothing
 *   higher   is this item dearer or cheaper than the last one?
 *   sort     four items, cheapest to dearest
 */
export const MODES = ['classic', 'hot', 'higher', 'sort'];
/** Teams: off, or two to four. A team scores its members' average each round. */
export const TEAM_CHOICES = [0, 2, 3, 4];
/** Items on the table per round. */
const PER_ROUND = { classic: 1, hot: 1, higher: 1, sort: 4 };
/** Sorting four items takes longer: switching to it lifts a shorter timer to this. */
const SORT_SECONDS = 60;
/** Items compared with each other (higher or lower, one sort round) are at least this far apart. */
const APART = 1.1;
/** Jokers per player and game. A joker scores the round's maximum without a guess. */
export const JOKER_CHOICES = [0, 1, 2, 3];
/** The players' colours; a price tag's first part picks one (in this order: Folio's `tag` palette). */
export const COLORS = ['mint', 'purple', 'orange', 'blue', 'pink', 'green', 'yellow', 'beige', 'teal', 'plum'];
/** The avatar's parts: 10 colours, 8 patterns and 23 figures (Folio's `tag` emblem; figure 0 is the initial). */
export const AVATAR_RANGES = [COLORS.length, 8, 23];

export const LIMITS = {
  rooms: 200,
  players: 24,
  name: 16,
  guess: 10_000_000,
  /** New rooms and game starts, across all rooms (the eBay quota is shared). */
  roomsPer10Min: 40,
  startsPerHour: 80,
};

/** Spare items per game, for the host's "skip" (one spare round when sorting). */
const SPARES = 4;
/** A few more for the modes that compare prices, since items too close to each other can't sit side by side. */
const SLACK = 4;
/** The host's seat passes on after they've been gone this long. */
const HOST_GRACE = 15_000;
/** Someone who closed the page in the lobby leaves the list after this. */
const LOBBY_GRACE = 60_000;
const EMPTY_TTL = 30 * 60_000;
const IDLE_TTL = 4 * 60 * 60_000;
/** After the last guess is in, the reveal waits this long, so it doesn't snap. */
const REVEAL_DELAY = 700;

export const DEFAULT_SETTINGS = Object.freeze({
  rounds: 10,
  seconds: 30,
  price: 'everyday',
  themes: Object.freeze([...THEME_KEYS]),
  showTitle: true,
  jokers: 1,
  mode: 'classic',
  teams: 0,
});

export class GameError extends Error {
  /** @param {string} code  @param {number} [status] */
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/**
 * @typedef {import('./items/mock.mjs').Item} Item
 * @typedef {{ draw(request: { count: number, price: string, themes: string[], exclude: Set<string> }): Promise<Item[]>, demo: boolean, name: string }} Source
 * @typedef {{ now(): number, setTimeout(fn: () => void, ms: number): any, clearTimeout(handle: any): void }} Clock
 */

/**
 * @param {{ source: Source, clock?: Clock }} options
 */
export function createGames({ source, clock = { now: Date.now, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) } }) {
  /** @type {Map<string, Room>} */
  const rooms = new Map();
  const created = [];
  const starts = [];

  // ---- helpers ------------------------------------------------------------------------------

  function room(code) {
    const r = rooms.get(String(code ?? '').toUpperCase());
    if (!r) throw new GameError('no-room', 404);
    return r;
  }

  function within(stamps, windowMs, limit) {
    const t = clock.now();
    while (stamps.length && stamps[0] <= t - windowMs) stamps.shift();
    if (stamps.length >= limit) return false;
    stamps.push(t);
    return true;
  }

  function newCode() {
    for (let i = 0; i < 100; i++) {
      let code = '';
      for (let j = 0; j < 4; j++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
    throw new GameError('busy', 503);
  }

  function player(r, token) {
    if (typeof token !== 'string' || !token) throw new GameError('no-player', 401);
    for (const p of r.players.values()) if (p.token === token && !p.left) return p;
    throw new GameError('no-player', 401);
  }

  function requireHost(r, p) {
    if (r.host !== p.id) throw new GameError('not-host', 403);
  }

  function requirePhase(r, ...phases) {
    if (!phases.includes(r.phase)) throw new GameError('wrong-phase', 409);
  }

  /** Players who are still in the game, in the order they joined. */
  function present(r) {
    return [...r.players.values()].filter((p) => !p.left);
  }

  function addPlayer(r, rawName, rawAvatar) {
    if (present(r).length >= LIMITS.players) throw new GameError('room-full', 409);
    const base = cleanName(rawName);
    if (!base) throw new GameError('name');
    const taken = new Set(present(r).map((p) => p.name.toLowerCase()));
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    // Without a tag of their own, someone gets a colour nobody in the room has yet.
    const used = new Set(present(r).map((p) => p.color));
    const free = COLORS.findIndex((c) => !used.has(c));
    const avatar = cleanAvatar(rawAvatar, free < 0 ? r.players.size % COLORS.length : free);
    const p = {
      id: randomBytes(6).toString('base64url'),
      token: randomBytes(18).toString('base64url'),
      name,
      // The player's colour is their tag's: the reveal's confetti and every avatar use it.
      color: COLORS[avatar[0]],
      // The avatar: a price tag, [colour, pattern, figure].
      avatar,
      score: 0,
      // Someone joining mid-game gets the game's allowance too.
      jokers: r.settings.jokers,
      // Someone new joins the smallest team.
      team: r.settings.teams ? smallestTeam(r, r.settings.teams) : null,
      joined: clock.now(),
      online: 0,
      offlineSince: clock.now(),
      left: false,
    };
    r.players.set(p.id, p);
    return p;
  }

  /** The team with the fewest players (the first of them on a tie). */
  function smallestTeam(r, teams) {
    const sizes = Array(teams).fill(0);
    for (const p of present(r)) if (p.team !== null && p.team < teams) sizes[p.team]++;
    return sizes.indexOf(Math.min(...sizes));
  }

  /** Everyone into teams again, in turn, in the order they joined (or shuffled first). */
  function spreadTeams(r, shuffled = false) {
    const teams = r.settings.teams;
    const people = present(r);
    if (shuffled) {
      for (let i = people.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [people[i], people[j]] = [people[j], people[i]];
      }
    }
    people.forEach((p, i) => (p.team = teams ? i % teams : null));
  }

  function touch(r) {
    r.touched = clock.now();
    r.version++;
    broadcast(r);
  }

  // ---- the view everybody gets ------------------------------------------------------------

  function view(r) {
    const round = r.phase === 'guess' || r.phase === 'reveal' ? r.round : null;
    const revealed = r.phase === 'reveal';
    return {
      code: r.code,
      phase: r.phase,
      demo: source.demo,
      version: r.version,
      host: r.host,
      settings: r.settings,
      notice: r.notice,
      players: present(r).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        score: p.score,
        online: p.online > 0,
        jokers: p.jokers,
        team: p.team,
        // A joker counts as a guess until the reveal, so nobody can tell who played one.
        guessed: Boolean(round && (round.guesses.has(p.id) || round.jokers.has(p.id))),
      })),
      // The game being played (its mode and teams), from its start to the rematch.
      game: r.game,
      teams: r.game?.teams ? r.teamScores : null,
      round: round
        ? {
              n: round.n,
              total: r.queue.length,
              endsAt: round.endsAt,
              skips: r.spares.length,
              mode: round.mode,
              item: round.item ? shown(round.item, revealed || r.settings.showTitle) : null,
              items: round.items ? round.items.map((item) => shown(item, revealed || r.settings.showTitle)) : null,
              // The item to beat was revealed the round before (or opens the game): its price shows.
              anchor: round.anchor ? { ...shown(round.anchor, true), price: round.anchor.price } : null,
            }
          : null,
      reveal:
        revealed && round.results
          ? {
              price: round.item ? round.item.price : null,
              url: round.item ? round.item.url : null,
              // Sorting: the four in their real order, cheapest first.
              items: round.items ? cheapestFirst(round.items).map((item) => ({ id: item.id, price: item.price, url: item.url })) : null,
              results: round.results,
              teams: round.teamPoints,
            }
          : null,
      history: r.phase === 'final' ? r.history : [],
      now: clock.now(),
    };
  }

  function broadcast(r) {
    if (!r.subscribers.size) return;
    const json = JSON.stringify(view(r));
    for (const s of r.subscribers) s.send(json);
  }

  // ---- rounds -----------------------------------------------------------------------------

  /** @param {Item | Item[]} deal  one item, or the four to sort */
  function startRound(r, n, deal) {
    clock.clearTimeout(r.timer);
    const now = clock.now();
    const mode = r.game.mode;
    r.round = {
      n,
      mode,
      item: Array.isArray(deal) ? null : deal,
      items: Array.isArray(deal) ? deal : null,
      // Higher or lower: the first round's item to beat opens the game; after that it's the last round's.
      anchor: mode === 'higher' ? (n === 1 ? r.anchor : r.queue[n - 2]) : null,
      startsAt: now,
      endsAt: now + r.settings.seconds * 1000,
      guesses: new Map(),
      jokers: new Set(),
      results: null,
      teamPoints: null,
    };
    r.phase = 'guess';
    r.timer = clock.setTimeout(() => reveal(r), r.settings.seconds * 1000);
  }

  function reveal(r) {
    if (r.phase !== 'guess' || !r.round) return;
    clock.clearTimeout(r.timer);
    r.timer = null;
    const round = r.round;
    const results = present(r).map((p) => {
      const joker = round.jokers.has(p.id);
      const result = judge(round, joker ? null : (round.guesses.get(p.id) ?? null));
      if (joker) result.points = MAX_POINTS;
      p.score += result.points;
      return { player: p.id, joker, ...result };
    });
    // Real guesses before jokers at equal points: the list ranks how close people got.
    results.sort((a, b) => b.points - a.points || Number(a.joker) - Number(b.joker) || Math.abs(a.deviation ?? 9) - Math.abs(b.deviation ?? 9));
    round.results = results;

    // The round's best real guess (never a joker): the red highlight, and "closest" in the recap.
    // Over the price doesn't count in "Der Preis ist heiß"; higher or lower has no single best.
    const best = round.mode === 'higher' ? null : (results.find((x) => played(x) && !x.over) ?? null);
    const entry = { n: round.n, mode: round.mode };
    if (round.items) entry.items = cheapestFirst(round.items).map(recapItem);
    else Object.assign(entry, recapItem(round.item));
    if (round.anchor) {
      entry.anchor = round.anchor.price;
      entry.right = results.filter((x) => played(x) && x.right).length;
      entry.picks = results.filter(played).length;
    }
    entry.best = best && { player: best.player, guess: best.guess ?? null, pairs: best.pairs ?? null, points: best.points };
    r.history.push(entry);

    // Teams score their members' average, so a team of two can beat a team of five.
    if (r.game.teams) {
      round.teamPoints = Array.from({ length: r.game.teams }, (_, team) => {
        const members = results.filter((x) => r.players.get(x.player)?.team === team);
        return members.length ? Math.round(members.reduce((sum, x) => sum + x.points, 0) / members.length) : 0;
      });
      round.teamPoints.forEach((points, team) => (r.teamScores[team] += points));
    }
    r.phase = 'reveal';
    touch(r);
  }

  /** Reveal now if everyone who's here has guessed (after a short beat). */
  function maybeReveal(r) {
    if (r.phase !== 'guess' || !r.round || r.round.early) return;
    const { guesses, jokers } = r.round;
    const waiting = present(r).filter((p) => p.online > 0 && !guesses.has(p.id) && !jokers.has(p.id));
    if (waiting.length || (!guesses.size && !jokers.size)) return;
    r.round.early = true;
    const round = r.round;
    clock.clearTimeout(r.timer);
    r.timer = clock.setTimeout(() => {
      if (r.round === round) reveal(r);
    }, REVEAL_DELAY);
  }

  async function startGame(r) {
    if (!r.settings.themes.length) throw new GameError('no-themes', 409);
    if (!within(starts, 60 * 60_000, LIMITS.startsPerHour)) throw new GameError('busy', 429);
    r.phase = 'loading';
    r.notice = null;
    touch(r);
    const mode = r.settings.mode;
    let items;
    try {
      items = await source.draw({
        count: r.settings.rounds * PER_ROUND[mode] + SPARES + (mode === 'classic' ? 0 : SLACK),
        price: r.settings.price,
        themes: [...r.settings.themes],
        exclude: r.seen,
      });
    } catch (error) {
      if (!rooms.has(r.code)) return;
      r.phase = 'lobby';
      r.notice = `items-failed:${error?.code ?? 'error'}`;
      touch(r);
      return;
    }
    if (!rooms.has(r.code) || r.phase !== 'loading') return;
    const deal = dealItems(mode, items, r.settings.rounds);
    if (!deal) {
      r.phase = 'lobby';
      r.notice = 'items-failed:empty';
      touch(r);
      return;
    }
    for (const item of items) r.seen.add(item.id);
    r.game = { mode, teams: r.settings.teams };
    r.queue = deal.queue;
    r.spares = deal.spares;
    r.anchor = deal.anchor;
    r.history = [];
    r.teamScores = Array(r.game.teams).fill(0);
    for (const p of r.players.values()) {
      p.score = 0;
      p.jokers = r.settings.jokers;
      if (r.game.teams && !p.left && !(p.team !== null && p.team < r.game.teams)) p.team = smallestTeam(r, r.game.teams);
    }
    startRound(r, 1, r.queue[0]);
    touch(r);
  }

  // ---- presence ---------------------------------------------------------------------------

  function handOver(r) {
    const host = r.players.get(r.host);
    if (host && !host.left && host.online > 0) return;
    const next = present(r).find((p) => p.online > 0);
    if (next && next.id !== r.host) {
      r.host = next.id;
      touch(r);
    }
  }

  // ---- public API ---------------------------------------------------------------------------

  return {
    get size() {
      return rooms.size;
    },

    /** @param {{ name: unknown, avatar?: unknown }} body */
    create({ name, avatar }) {
      if (!cleanName(name)) throw new GameError('name');
      if (rooms.size >= LIMITS.rooms || !within(created, 10 * 60_000, LIMITS.roomsPer10Min)) throw new GameError('busy', 429);
      const code = newCode();
      /** @type {Room} */
      const r = {
        code,
        created: clock.now(),
        touched: clock.now(),
        version: 0,
        host: '',
        players: new Map(),
        settings: { ...DEFAULT_SETTINGS, themes: [...DEFAULT_SETTINGS.themes] },
        phase: 'lobby',
        queue: [],
        spares: [],
        round: null,
        history: [],
        game: null,
        anchor: null,
        teamScores: [],
        seen: new Set(),
        notice: null,
        timer: null,
        subscribers: new Set(),
      };
      rooms.set(code, r);
      const p = addPlayer(r, name, avatar);
      r.host = p.id;
      return { code, player: p.id, token: p.token };
    },

    /** A quick look before joining: does the room exist, and is it open? */
    info(code) {
      const r = rooms.get(String(code ?? '').toUpperCase());
      if (!r) return null;
      return { code: r.code, phase: r.phase, players: present(r).length, full: present(r).length >= LIMITS.players, demo: source.demo };
    },

    /**
     * Joins, or comes back: a known token gets the same seat (and score) again. A token alone that
     * no longer fits (kicked, or dropped from the lobby) is refused, so a reload doesn't sneak a
     * removed player back in under a new seat; they join again with their name.
     * @param {{ name?: unknown, avatar?: unknown, token?: unknown }} body
     */
    join(code, { name, avatar, token }) {
      const r = room(code);
      if (typeof token === 'string' && token) {
        for (const p of r.players.values()) {
          if (p.token === token && !p.left) return { code: r.code, player: p.id, token: p.token };
        }
        if (!cleanName(name)) throw new GameError('no-player', 401);
      }
      const p = addPlayer(r, name, avatar);
      touch(r);
      return { code: r.code, player: p.id, token: p.token };
    },

    view(code) {
      return view(room(code));
    },

    /**
     * Streams the room to one player's page. `send` gets the view as JSON now and after every
     * change. Returns the unsubscribe function.
     * @param {(json: string) => void} send
     */
    subscribe(code, playerId, send) {
      const r = room(code);
      const p = r.players.get(String(playerId ?? ''));
      const sub = { send };
      r.subscribers.add(sub);
      if (p && !p.left) {
        p.online++;
        p.offlineSince = null;
      }
      send(JSON.stringify(view(r)));
      // The others see them come online. The host's seat only moves in tick(), after a grace period,
      // so a host whose page is still loading doesn't lose it to the first joiner.
      if (p && p.online === 1) touch(r);
      return () => {
        if (!r.subscribers.delete(sub)) return;
        if (p && !p.left) {
          p.online = Math.max(0, p.online - 1);
          if (p.online === 0) {
            p.offlineSince = clock.now();
            touch(r);
            maybeReveal(r);
          }
        }
      };
    },

    /**
     * A player's move. Throws GameError for anything not allowed right now.
     * @param {string} code  @param {unknown} token  @param {string} action  @param {any} body
     */
    async act(code, token, action, body = {}) {
      const r = room(code);
      const p = player(r, token);
      r.touched = clock.now();

      switch (action) {
        case 'settings': {
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          const teams = r.settings.teams;
          r.settings = mergeSettings(r.settings, body);
          // New teams in the lobby; after a game they wait for the rematch, so the results stay put.
          if (r.phase === 'lobby' && r.settings.teams !== teams) spreadTeams(r);
          r.notice = null;
          touch(r);
          return;
        }
        case 'start': {
          requireHost(r, p);
          requirePhase(r, 'lobby');
          await startGame(r);
          return;
        }
        case 'guess': {
          requirePhase(r, 'guess');
          if (r.round.guesses.has(p.id) || r.round.jokers.has(p.id)) throw new GameError('already-guessed', 409);
          r.round.guesses.set(p.id, readGuess(r.round, body));
          touch(r);
          maybeReveal(r);
          return;
        }
        case 'joker': {
          requirePhase(r, 'guess');
          if (r.round.guesses.has(p.id) || r.round.jokers.has(p.id)) throw new GameError('already-guessed', 409);
          if (!(p.jokers > 0)) throw new GameError('no-jokers', 409);
          p.jokers--;
          r.round.jokers.add(p.id);
          touch(r);
          maybeReveal(r);
          return;
        }
        case 'skip': {
          requireHost(r, p);
          requirePhase(r, 'guess');
          const next = takeSpare(r);
          if (!next) throw new GameError('no-spares', 409);
          // A joker played on the skipped item goes back to its player.
          for (const id of r.round.jokers) {
            const q = r.players.get(id);
            if (q) q.jokers++;
          }
          r.queue[r.round.n - 1] = next;
          startRound(r, r.round.n, next);
          touch(r);
          return;
        }
        case 'next': {
          requireHost(r, p);
          requirePhase(r, 'reveal');
          const n = r.round.n + 1;
          if (n > r.queue.length) r.phase = 'final';
          else startRound(r, n, r.queue[n - 1]);
          touch(r);
          return;
        }
        case 'rematch': {
          requireHost(r, p);
          requirePhase(r, 'final');
          clock.clearTimeout(r.timer);
          r.phase = 'lobby';
          r.round = null;
          r.history = [];
          if (r.settings.teams !== r.game?.teams) spreadTeams(r);
          r.game = null;
          r.teamScores = [];
          for (const q of r.players.values()) {
            q.score = 0;
            q.jokers = r.settings.jokers;
          }
          touch(r);
          return;
        }
        case 'team': {
          // Anyone picks their own team in the lobby.
          requirePhase(r, 'lobby');
          const team = body.team;
          if (!r.settings.teams || !Number.isInteger(team) || team < 0 || team >= r.settings.teams) throw new GameError('team');
          p.team = team;
          touch(r);
          return;
        }
        case 'avatar': {
          // Anyone changes their own avatar, at any time.
          if (!isAvatar(body.avatar)) throw new GameError('avatar');
          p.avatar = [...body.avatar];
          p.color = COLORS[p.avatar[0]];
          touch(r);
          return;
        }
        case 'shuffle': {
          requireHost(r, p);
          requirePhase(r, 'lobby');
          if (!r.settings.teams) throw new GameError('team');
          spreadTeams(r, true);
          touch(r);
          return;
        }
        case 'kick': {
          requireHost(r, p);
          const target = r.players.get(String(body.player ?? ''));
          if (!target || target.left || target.id === p.id) throw new GameError('no-player', 404);
          removePlayer(r, target);
          return;
        }
        case 'leave': {
          removePlayer(r, p);
          return;
        }
        default:
          throw new GameError('unknown-action', 404);
      }
    },

    /**
     * Housekeeping, every few seconds: hand the host's seat on, drop people who closed the page
     * in the lobby, forget empty rooms, and end a round whose timer was lost.
     */
    tick() {
      const t = clock.now();
      for (const r of rooms.values()) {
        const online = present(r).filter((p) => p.online > 0);
        if ((!online.length && t - r.touched > EMPTY_TTL) || t - r.touched > IDLE_TTL) {
          clock.clearTimeout(r.timer);
          for (const s of r.subscribers) s.send(JSON.stringify({ code: r.code, phase: 'gone' }));
          rooms.delete(r.code);
          continue;
        }
        const host = r.players.get(r.host);
        if (host && host.online === 0 && host.offlineSince !== null && t - host.offlineSince >= HOST_GRACE) handOver(r);
        if (r.phase === 'lobby') {
          for (const p of present(r)) {
            if (p.id !== r.host && p.online === 0 && p.offlineSince !== null && t - p.offlineSince >= LOBBY_GRACE) removePlayer(r, p);
          }
        }
        if (r.phase === 'guess' && r.round && t >= r.round.endsAt + 2000) reveal(r);
      }
    },

    /** Stops every timer and tells every page the server is going away (shutdown, tests). */
    close() {
      for (const r of rooms.values()) {
        clock.clearTimeout(r.timer);
        r.subscribers.clear();
      }
      rooms.clear();
    },
  };

  function removePlayer(r, p) {
    if (r.phase === 'lobby') r.players.delete(p.id);
    else p.left = true;
    p.online = 0;
    if (r.host === p.id) {
      const next = present(r).find((q) => q.online > 0) ?? present(r)[0];
      if (next) r.host = next.id;
    }
    if (!present(r).length) {
      clock.clearTimeout(r.timer);
      rooms.delete(r.code);
      for (const s of r.subscribers) s.send(JSON.stringify({ code: r.code, phase: 'gone' }));
      return;
    }
    touch(r);
    maybeReveal(r);
  }

  /** An item as the players see it: no price, and the title only when it's allowed to show. */
  function shown(item, title) {
    return { id: item.id, title: title ? item.title : null, condition: item.condition, theme: item.theme, images: item.images, art: item.art };
  }

  /**
   * The next spare for a skip. Higher or lower takes one far enough from the item to beat and
   * from the next round's item (whose item to beat it becomes).
   */
  function takeSpare(r) {
    if (r.round.mode === 'higher' && r.spares.length) {
      const near = [r.round.anchor, r.queue[r.round.n]].filter(Boolean);
      let i = r.spares.findIndex((item) => near.every((other) => apart(item.price, other.price)));
      if (i === -1) i = r.spares.findIndex((item) => apart(item.price, r.round.anchor.price));
      return r.spares.splice(Math.max(0, i), 1)[0];
    }
    return r.spares.shift();
  }
}

/**
 * What one player's move scores in a round (a joker's points are set by the caller).
 * @param {any} round  @param {any} guess  the stored guess, or null for none
 */
function judge(round, guess) {
  switch (round.mode) {
    case 'higher': {
      const points = guess === null ? 0 : scorePick(guess, round.anchor.price, round.item.price);
      return { pick: guess, right: guess === null ? null : points > 0, points };
    }
    case 'sort': {
      if (guess === null) return { order: null, pairs: null, points: 0 };
      const { pairs, points } = scoreOrder(guess, new Map(round.items.map((item) => [item.id, item.price])));
      return { order: guess, pairs, points };
    }
    case 'hot': {
      const price = round.item.price;
      if (guess === null) return { guess, points: 0, deviation: null, bullseye: false, over: false };
      const over = guess > price;
      return { guess, points: scoreUnder(guess, price), deviation: deviation(guess, price), bullseye: !over && bullseye(guess, price), over };
    }
    default: {
      const price = round.item.price;
      if (guess === null) return { guess, points: 0, deviation: null, bullseye: false };
      return { guess, points: score(guess, price), deviation: deviation(guess, price), bullseye: bullseye(guess, price) };
    }
  }
}

/** A guess as the round's mode takes it; GameError('guess') for anything else. */
function readGuess(round, body) {
  switch (round.mode) {
    case 'higher':
      if (body?.pick !== 'higher' && body?.pick !== 'lower') throw new GameError('guess');
      return body.pick;
    case 'sort': {
      const ids = round.items.map((item) => item.id);
      const order = body?.order;
      if (!Array.isArray(order) || order.length !== ids.length || new Set(order).size !== ids.length || !order.every((id) => ids.includes(id))) {
        throw new GameError('guess');
      }
      return [...order];
    }
    default: {
      const value = Number(body?.value);
      if (!Number.isFinite(value) || value <= 0 || value > LIMITS.guess) throw new GameError('guess');
      return Math.round(value * 100) / 100;
    }
  }
}

/** A result that guessed something (not a joker, not a miss). */
function played(result) {
  return !result.joker && (result.guess ?? result.pick ?? result.order ?? null) !== null;
}

function apart(a, b) {
  return Math.max(a, b) / Math.min(a, b) >= APART;
}

function cheapestFirst(items) {
  return [...items].sort((a, b) => a.price - b.price);
}

function recapItem(item) {
  return { title: item.title, price: item.price, url: item.url, art: item.art, image: item.images[0] ?? null };
}

/**
 * The drawn items laid out as a game: the rounds' items in order, the spares for skips, and for
 * higher or lower the item that opens the game. Fewer items than rounds makes a shorter game;
 * null when not even one round fits.
 *
 * @param {string} mode  @param {Item[]} items  @param {number} rounds
 * @returns {{ queue: Array<Item | Item[]>, spares: Array<Item | Item[]>, anchor: Item | null } | null}
 */
export function dealItems(mode, items, rounds) {
  if (mode === 'sort') {
    const groups = groupItems(items, PER_ROUND.sort);
    if (!groups.length) return null;
    const n = Math.min(rounds, groups.length);
    return { queue: groups.slice(0, n), spares: groups.slice(n), anchor: null };
  }
  if (mode === 'higher') {
    const { chain, rest } = chainItems(items);
    if (chain.length < 2) return null;
    const n = Math.min(rounds, chain.length - 1);
    return { anchor: chain[0], queue: chain.slice(1, n + 1), spares: [...chain.slice(n + 1), ...rest] };
  }
  if (!items.length) return null;
  const n = Math.min(rounds, items.length);
  return { queue: items.slice(0, n), spares: items.slice(n), anchor: null };
}

/** Items in an order where each one's price is at least APART from the one before. */
export function chainItems(items) {
  const pool = [...items];
  const chain = [];
  while (pool.length) {
    const last = chain.at(-1);
    const i = last ? pool.findIndex((item) => apart(item.price, last.price)) : 0;
    if (i === -1) break;
    chain.push(pool.splice(i, 1)[0]);
  }
  return { chain, rest: pool };
}

/** Groups of `size` whose prices are all at least APART from each other; leftovers are dropped. */
export function groupItems(items, size) {
  const pool = [...items];
  const groups = [];
  while (pool.length >= size) {
    const group = [];
    for (let i = 0; i < pool.length && group.length < size; ) {
      if (group.every((other) => apart(other.price, pool[i].price))) group.push(pool.splice(i, 1)[0]);
      else i++;
    }
    if (group.length < size) break;
    groups.push(group);
  }
  return groups;
}

/**
 * A display name: printable, single-spaced, at most LIMITS.name characters (graphemes, so an
 * emoji counts as one). Empty when nothing usable is left.
 */
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  // Control and invisible format characters go; the zero-width joiner stays (it builds emoji).
  const text = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Co}\p{Cn}]|(?!\u200D)\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const graphemes = [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return graphemes.slice(0, LIMITS.name).join('').trim();
}

/**
 * An avatar: Folio's `tag` emblem (development/plans/emblems.md), [colour, pattern, figure] within
 * AVATAR_RANGES. Anything else gets the given colour, a random pattern and figure 0, the name's
 * initial, so a bad value never blocks a join. (The image has no vendor/, so this checks the ranges itself rather than import Folio's
 * cleanEmblem; they match emblem-tag's parts.)
 */
export function cleanAvatar(raw, colour = randomInt(AVATAR_RANGES[0])) {
  return isAvatar(raw) ? [...raw] : [colour, randomInt(AVATAR_RANGES[1]), 0];
}

export function isAvatar(raw) {
  return Array.isArray(raw) && raw.length === AVATAR_RANGES.length && raw.every((v, i) => Number.isInteger(v) && v >= 0 && v < AVATAR_RANGES[i]);
}

/** The settings with a host's changes applied; anything invalid is ignored. */
export function mergeSettings(current, body) {
  const next = { ...current, themes: [...current.themes] };
  if (ROUND_CHOICES.includes(body?.rounds)) next.rounds = body.rounds;
  if (SECOND_CHOICES.includes(body?.seconds)) next.seconds = body.seconds;
  if (isPriceRange(body?.price)) next.price = body.price;
  if (typeof body?.showTitle === 'boolean') next.showTitle = body.showTitle;
  if (JOKER_CHOICES.includes(body?.jokers)) next.jokers = body.jokers;
  if (MODES.includes(body?.mode)) next.mode = body.mode;
  if (TEAM_CHOICES.includes(body?.teams)) next.teams = body.teams;
  // Sorting four items takes longer: switching to it lifts a short timer, unless the change sets one.
  if (next.mode === 'sort' && current.mode !== 'sort' && !SECOND_CHOICES.includes(body?.seconds) && next.seconds < SORT_SECONDS) {
    next.seconds = SORT_SECONDS;
  }
  // Any selection, none included: the host picks freely, and a game only starts with one or more.
  if (Array.isArray(body?.themes)) next.themes = THEME_KEYS.filter((key) => body.themes.includes(key) && isTheme(key));
  return next;
}

/**
 * @typedef {object} Room
 * @property {string} code
 * @property {number} created
 * @property {number} touched
 * @property {number} version
 * @property {string} host
 * @property {Map<string, any>} players
 * @property {any} settings
 * @property {'lobby' | 'loading' | 'guess' | 'reveal' | 'final'} phase
 * @property {Array<Item | Item[]>} queue
 * @property {Array<Item | Item[]>} spares
 * @property {any} round
 * @property {any[]} history
 * @property {{ mode: string, teams: number } | null} game  the game being played, from its start to the rematch
 * @property {Item | null} anchor  higher or lower: the item that opens the game
 * @property {number[]} teamScores
 * @property {Set<string>} seen
 * @property {string | null} notice
 * @property {any} timer
 * @property {Set<{ send(json: string): void }>} subscribers
 */
