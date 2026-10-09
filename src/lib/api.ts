// The server's shapes (server/game.mjs → view) and the calls that change them.

export type Phase = 'lobby' | 'loading' | 'guess' | 'reveal' | 'final' | 'gone';
export type Theme = 'tech' | 'home' | 'kitchen' | 'fashion' | 'toys' | 'collect' | 'outdoor' | 'garden' | 'odd';
export type PriceRange = 'small' | 'everyday' | 'all';
/** classic: guess the price · hot: don't go over · higher: dearer or cheaper than the last · sort: four in order */
export type Mode = 'classic' | 'hot' | 'higher' | 'sort';
export type Pick = 'higher' | 'lower';
export type Tint = 'beige' | 'blue' | 'green' | 'mint' | 'orange' | 'pink' | 'purple' | 'yellow' | 'warm';

export interface Settings {
  rounds: number;
  seconds: number;
  price: PriceRange;
  themes: Theme[];
  showTitle: boolean;
  /** Jokers per player and game; a joker scores the round's maximum without a guess. */
  jokers: number;
  mode: Mode;
  /** 0 (off), or 2 to 4 teams. */
  teams: number;
}

/** A price tag, Folio's `tag` emblem: [colour 0–9, pattern 0–7, figure 0–22]; figure 0 is the name's initial. */
export type Avatar = [number, number, number];

export interface Player {
  id: string;
  name: string;
  color: string;
  /** The avatar: a price tag; its colour is `color`. */
  avatar: Avatar;
  score: number;
  online: boolean;
  /** Guessed, or played a joker (the two look the same until the reveal). */
  guessed: boolean;
  /** Jokers left in this game. */
  jokers: number;
  /** Their team's index, or null without teams. */
  team: number | null;
}

export interface Art {
  emoji: string;
  tint: Tint;
}

export interface Item {
  id: string;
  title: string | null;
  condition: string;
  theme: Theme;
  images: string[];
  art: Art | null;
}

/** One player's round. Which fields are there depends on the mode. */
export interface Result {
  player: string;
  joker: boolean;
  points: number;
  /** classic, hot */
  guess?: number | null;
  deviation?: number | null;
  bullseye?: boolean;
  /** hot: over the price, so 0 */
  over?: boolean;
  /** higher */
  pick?: Pick | null;
  right?: boolean | null;
  /** sort: item ids, cheapest first as they put them, and how many of the six pairs were right */
  order?: string[] | null;
  pairs?: number | null;
}

export interface RecapItem {
  title: string;
  price: number;
  url: string | null;
  art: Art | null;
  image: string | null;
}

export interface Recap extends Partial<RecapItem> {
  n: number;
  mode: Mode;
  /** sort: the four, cheapest first */
  items?: RecapItem[];
  /** higher: the price to beat, and how many of those who picked were right */
  anchor?: number;
  right?: number;
  picks?: number;
  best: { player: string; guess: number | null; pairs: number | null; points: number } | null;
}

export interface Round {
  n: number;
  total: number;
  endsAt: number;
  skips: number;
  mode: Mode;
  /** classic, hot, higher */
  item: Item | null;
  /** sort */
  items: Item[] | null;
  /** higher: the item to beat, with its price */
  anchor: (Item & { price: number }) | null;
}

export interface View {
  code: string;
  phase: Phase;
  demo: boolean;
  version: number;
  host: string;
  settings: Settings;
  notice: string | null;
  players: Player[];
  /** The game being played, from its start to the rematch. */
  game: { mode: Mode; teams: number } | null;
  /** Each team's total in this game. */
  teams: number[] | null;
  round: Round | null;
  reveal: {
    price: number | null;
    url: string | null;
    /** sort: the real order, cheapest first */
    items: { id: string; price: number; url: string | null }[] | null;
    results: Result[];
    /** Each team's points this round. */
    teams: number[] | null;
  } | null;
  history: Recap[];
  /** The host ended the game early (in the final view). */
  ended: { by: string } | null;
  now: number;
}

export interface Seat {
  code: string;
  player: string;
  token: string;
}

export interface Config {
  demo: boolean;
  themes: Theme[];
  prices: PriceRange[];
  rounds: number[];
  seconds: number[];
  jokers: number[];
  modes: Mode[];
  teams: number[];
}

/** A refusal from the server ("no-room", "not-host" …) or a network failure ("offline"). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: 'no-store' });
  } catch {
    // Given up on (the signal from track(), 12 s), or the network: Safari says "Load failed", Chrome
    // "Failed to fetch", so classify by type (learnings/ios-and-webkit.md).
    throw new ApiError(init.signal?.aborted ? 'timeout' : 'offline');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // A 5xx without the game's own error is the NAS or Cloudflare (a 502, a 1033 page).
    throw new ApiError(body?.error ?? (response.status >= 500 ? 'busy' : `http-${response.status}`), response.status);
  }
  return body as T;
}

const post = (body: unknown, token?: string, signal?: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-schaetzle-token': token } : {}) },
  body: JSON.stringify(body ?? {}),
  signal,
});

export const api = {
  config: () => request<Config>('/api/config'),
  /** `key`: the same for every try of one "New game", so a retry after a timeout gets the same room. */
  create: (name: string, avatar: Avatar, key?: string, signal?: AbortSignal) => request<Seat>('/api/rooms', post({ name, avatar, key }, undefined, signal)),
  info: (code: string) => request<{ code: string; phase: Phase; players: number; full: boolean; demo: boolean }>(`/api/rooms/${code}`),
  /** `key`: as for create, so a retried join doesn't seat you twice. */
  join: (code: string, name: string, avatar: Avatar | null, token?: string, key?: string, signal?: AbortSignal) =>
    request<Seat>(`/api/rooms/${code}/join`, post({ name, avatar, token, key }, undefined, signal)),
  act: (seat: Seat, action: string, body?: unknown, signal?: AbortSignal) => request<void>(`/api/rooms/${seat.code}/${action}`, post(body, seat.token, signal)),
};

/** Room codes: four consonants (server/game.mjs → CODE). */
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;
