// The game: rooms, players, rounds and the clock. No I/O: the HTTP layer (server/api.mjs) calls
// these functions and streams each room's view to its players; tests drive it with a fake clock.
//
// A room lives in memory only. A restart (a deploy) ends every game, and an empty room is
// forgotten after half an hour.
//
// Phases: lobby → loading (drawing items) → guess ⇄ reveal → final → (rematch) lobby.

import { randomBytes, randomInt } from 'node:crypto';
import { MAX_POINTS, bullseye, deviation, score } from './scoring.mjs';
import { THEME_KEYS, isPriceRange, isTheme } from './items/themes.mjs';

/** Room codes have no vowels, so no code spells a word. */
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;

export const ROUND_CHOICES = [5, 10, 15];
export const SECOND_CHOICES = [20, 30, 45, 60];
/** Jokers per player and game. A joker scores the round's maximum without a guess. */
export const JOKER_CHOICES = [0, 1, 2, 3];
export const COLORS = ['mint', 'purple', 'orange', 'blue', 'pink', 'green', 'yellow', 'beige', 'teal', 'plum'];

export const LIMITS = {
  rooms: 200,
  players: 24,
  name: 16,
  guess: 10_000_000,
  /** New rooms and game starts, across all rooms (the eBay quota is shared). */
  roomsPer10Min: 40,
  startsPerHour: 80,
};

/** Spare items per game, for the host's "skip". */
const SPARES = 4;
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

  function addPlayer(r, rawName) {
    if (present(r).length >= LIMITS.players) throw new GameError('room-full', 409);
    const base = cleanName(rawName);
    if (!base) throw new GameError('name');
    const taken = new Set(present(r).map((p) => p.name.toLowerCase()));
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    const used = new Set(present(r).map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[r.players.size % COLORS.length];
    const p = {
      id: randomBytes(6).toString('base64url'),
      token: randomBytes(18).toString('base64url'),
      name,
      color,
      score: 0,
      // Someone joining mid-game gets the game's allowance too.
      jokers: r.settings.jokers,
      joined: clock.now(),
      online: 0,
      offlineSince: clock.now(),
      left: false,
    };
    r.players.set(p.id, p);
    return p;
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
        score: p.score,
        online: p.online > 0,
        jokers: p.jokers,
        // A joker counts as a guess until the reveal, so nobody can tell who played one.
        guessed: Boolean(round && (round.guesses.has(p.id) || round.jokers.has(p.id))),
      })),
      round: round
        ? {
              n: round.n,
              total: r.queue.length,
              endsAt: round.endsAt,
              skips: r.spares.length,
              item: {
                id: round.item.id,
                title: revealed || r.settings.showTitle ? round.item.title : null,
                condition: round.item.condition,
                theme: round.item.theme,
                images: round.item.images,
                art: round.item.art,
              },
            }
          : null,
      reveal: revealed && round.results ? { price: round.item.price, url: round.item.url, results: round.results } : null,
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

  function startRound(r, n, item) {
    clock.clearTimeout(r.timer);
    const now = clock.now();
    r.round = { n, item, startsAt: now, endsAt: now + r.settings.seconds * 1000, guesses: new Map(), jokers: new Set(), results: null };
    r.phase = 'guess';
    r.timer = clock.setTimeout(() => reveal(r), r.settings.seconds * 1000);
  }

  function reveal(r) {
    if (r.phase !== 'guess' || !r.round) return;
    clock.clearTimeout(r.timer);
    r.timer = null;
    const { item, guesses, jokers } = r.round;
    const results = present(r).map((p) => {
      const joker = jokers.has(p.id);
      const guess = joker ? null : (guesses.get(p.id) ?? null);
      const points = joker ? MAX_POINTS : guess === null ? 0 : score(guess, item.price);
      p.score += points;
      return {
        player: p.id,
        guess,
        joker,
        points,
        deviation: guess === null ? null : deviation(guess, item.price),
        bullseye: guess !== null && bullseye(guess, item.price),
      };
    });
    // Real guesses before jokers at equal points: the list ranks how close people got.
    results.sort((a, b) => b.points - a.points || Number(a.joker) - Number(b.joker) || Math.abs(a.deviation ?? 9) - Math.abs(b.deviation ?? 9));
    r.round.results = results;
    const best = results.find((x) => x.guess !== null) ?? null;
    r.history.push({
      n: r.round.n,
      title: item.title,
      price: item.price,
      url: item.url,
      art: item.art,
      image: item.images[0] ?? null,
      best: best && { player: best.player, guess: best.guess, points: best.points },
    });
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
    let items;
    try {
      items = await source.draw({
        count: r.settings.rounds + SPARES,
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
    if (items.length < 1) {
      r.phase = 'lobby';
      r.notice = 'items-failed:empty';
      touch(r);
      return;
    }
    for (const item of items) r.seen.add(item.id);
    // Fewer items than rounds (a narrow filter) makes a shorter game, not a broken one.
    const rounds = Math.min(r.settings.rounds, items.length);
    r.queue = items.slice(0, rounds);
    r.spares = items.slice(rounds);
    r.history = [];
    for (const p of r.players.values()) {
      p.score = 0;
      p.jokers = r.settings.jokers;
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

    /** @param {{ name: unknown }} body */
    create({ name }) {
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
        seen: new Set(),
        notice: null,
        timer: null,
        subscribers: new Set(),
      };
      rooms.set(code, r);
      const p = addPlayer(r, name);
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
     * @param {{ name?: unknown, token?: unknown }} body
     */
    join(code, { name, token }) {
      const r = room(code);
      if (typeof token === 'string' && token) {
        for (const p of r.players.values()) {
          if (p.token === token && !p.left) return { code: r.code, player: p.id, token: p.token };
        }
        if (!cleanName(name)) throw new GameError('no-player', 401);
      }
      const p = addPlayer(r, name);
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
          r.settings = mergeSettings(r.settings, body);
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
          if (r.round.guesses.has(p.id)) throw new GameError('already-guessed', 409);
          const value = Number(body.value);
          if (!Number.isFinite(value) || value <= 0 || value > LIMITS.guess) throw new GameError('guess');
          if (r.round.jokers.has(p.id)) throw new GameError('already-guessed', 409);
          r.round.guesses.set(p.id, Math.round(value * 100) / 100);
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
          const next = r.spares.shift();
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
          for (const q of r.players.values()) {
            q.score = 0;
            q.jokers = r.settings.jokers;
          }
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

/** The settings with a host's changes applied; anything invalid is ignored. */
export function mergeSettings(current, body) {
  const next = { ...current, themes: [...current.themes] };
  if (ROUND_CHOICES.includes(body?.rounds)) next.rounds = body.rounds;
  if (SECOND_CHOICES.includes(body?.seconds)) next.seconds = body.seconds;
  if (isPriceRange(body?.price)) next.price = body.price;
  if (typeof body?.showTitle === 'boolean') next.showTitle = body.showTitle;
  if (JOKER_CHOICES.includes(body?.jokers)) next.jokers = body.jokers;
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
 * @property {Item[]} queue
 * @property {Item[]} spares
 * @property {any} round
 * @property {any[]} history
 * @property {Set<string>} seen
 * @property {string | null} notice
 * @property {any} timer
 * @property {Set<{ send(json: string): void }>} subscribers
 */
