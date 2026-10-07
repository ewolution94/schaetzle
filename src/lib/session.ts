// What a device remembers: the name and avatar you play under, and your seat in each room (so a reload, or
// the phone locking mid-game, puts you back in the same seat with your score). Storage can be
// blocked; then nothing is remembered and everything still works.

import type { Seat } from './api';

const NAME = 'schaetzle:name';
const EMOJI = 'schaetzle:emoji';
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

export const savedName = () => read(NAME) ?? '';
export const saveName = (name: string) => write(NAME, name.trim() || null);
/** The avatar's emoji, or null for the name's initial. */
export const savedEmoji = () => read(EMOJI) || null;
export const saveEmoji = (emoji: string | null) => write(EMOJI, emoji);

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
