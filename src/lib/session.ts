// What a device remembers: the name and avatar you play under, and your seat in each room (so a reload, or
// the phone locking mid-game, puts you back in the same seat with your score). The name and the tag also
// go to Folio's shared cookie, so they follow you to the other ewolution games (development/plans/emblems.md).
// Storage can be blocked; then nothing is remembered and everything still works.

import type { Avatar, Seat } from './api';
import { relatedEmblem, shareEmblem, sharedEmblem, sharedName, shareName } from '../../vendor/ewo/elements/emblem-shared.js';

const NAME = 'schaetzle:name';
const AVATAR = 'schaetzle:avatar';
const SEAT = 'schaetzle:seat:';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // not kept
  }
}

/** The name field's maxlength: a name from another game may be longer. */
const NAME_MAX = 24;

/** The name you last joined with, here or in another ewolution game. */
export const savedName = () => (sharedName() || read(NAME) || '').slice(0, NAME_MAX);
export function saveName(name: string) {
  write(NAME, name.trim() || null);
  shareName(name);
}
/** The avatar's parts: colours, patterns and figures (server/game.mjs → AVATAR_RANGES, Folio's `tag` emblem). */
const RANGES = [14, 12, 31];

const own = (): Avatar | null => {
  try {
    const value = JSON.parse(read(AVATAR) ?? 'null');
    if (Array.isArray(value) && value.length === 3 && value.every((v, i) => Number.isInteger(v) && v >= 0 && v < RANGES[i])) return [value[0], value[1], value[2]];
  } catch {
    // none
  }
  return null;
};

/**
 * The price tag this device plays under: the one you last picked, here or in another game; else this
 * game's own, else one with your coin's or shield's charge from the other games; the first time, a random
 * colour and pattern with the name's initial.
 */
export function savedAvatar(): Avatar {
  const shared = (sharedEmblem('tag') ?? own() ?? relatedEmblem('tag')) as Avatar | null;
  return shared ?? [Math.floor(Math.random() * RANGES[0]), Math.floor(Math.random() * RANGES[1]), 0];
}
/** Kept here; shared with the other games when it's new (a pick, or the first tag you join with), not when joining with the one you had. */
export function saveAvatar(avatar: Avatar) {
  const before = own();
  write(AVATAR, JSON.stringify(avatar));
  if (String(before) !== String(avatar)) shareEmblem('tag', avatar);
}

// The emoji avatars' key, from before the price tags (2026-10-07).
write('schaetzle:emoji', null);

export function savedSeat(code: string): Seat | null {
  try {
    const seat = JSON.parse(read(SEAT + code) ?? 'null');
    return seat && typeof seat.token === 'string' && typeof seat.player === 'string' ? { ...seat, code } : null;
  } catch {
    return null;
  }
}

export function saveSeat(seat: Seat) {
  write(SEAT + seat.code, JSON.stringify({ player: seat.player, token: seat.token, at: Date.now() }));
  // Old rooms are long gone after a day; keep the storage tidy.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SEAT) || key === SEAT + seat.code) continue;
      const at = JSON.parse(localStorage.getItem(key) ?? '{}')?.at ?? 0;
      if (Date.now() - at > 24 * 60 * 60_000) localStorage.removeItem(key);
    }
  } catch {
    // fine
  }
}

export const forgetSeat = (code: string) => write(SEAT + code, null);
