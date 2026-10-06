// The server's shapes (server/game.mjs → view) and the calls that change them.

export type Phase = 'lobby' | 'loading' | 'guess' | 'reveal' | 'final' | 'gone';
export type Theme = 'tech' | 'home' | 'kitchen' | 'fashion' | 'toys' | 'collect' | 'outdoor' | 'garden' | 'odd';
export type PriceRange = 'small' | 'everyday' | 'all';
export type Tint = 'beige' | 'blue' | 'green' | 'mint' | 'orange' | 'pink' | 'purple' | 'yellow' | 'warm';

export interface Settings {
  rounds: number;
  seconds: number;
  price: PriceRange;
  themes: Theme[];
  showTitle: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  online: boolean;
  guessed: boolean;
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

export interface Result {
  player: string;
  guess: number | null;
  points: number;
  deviation: number | null;
  bullseye: boolean;
}

export interface Recap {
  n: number;
  title: string;
  price: number;
  url: string | null;
  art: Art | null;
  image: string | null;
  best: { player: string; guess: number; points: number } | null;
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
  round: { n: number; total: number; endsAt: number; skips: number; item: Item } | null;
  reveal: { price: number; url: string | null; results: Result[] } | null;
  history: Recap[];
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
    // Safari says "Load failed", Chrome "Failed to fetch": classify by type (learnings/ios-and-webkit.md).
    throw new ApiError('offline');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error ?? `http-${response.status}`, response.status);
  return body as T;
}

const post = (body: unknown, token?: string): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-schaetzle-token': token } : {}) },
  body: JSON.stringify(body ?? {}),
});

export const api = {
  config: () => request<Config>('/api/config'),
  create: (name: string) => request<Seat>('/api/rooms', post({ name })),
  info: (code: string) => request<{ code: string; phase: Phase; players: number; full: boolean; demo: boolean }>(`/api/rooms/${code}`),
  join: (code: string, name: string, token?: string) => request<Seat>(`/api/rooms/${code}/join`, post({ name, token })),
  act: (seat: Seat, action: string, body?: unknown) => request<void>(`/api/rooms/${seat.code}/${action}`, post(body, seat.token)),
};

/** Room codes: four consonants (server/game.mjs → CODE). */
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;
