// Rotation: when each collected listing was last in a game, so the next games prefer the ones that
// haven't come up for longest (the user, 2026-10-09: "items from past sessions don't show up too
// quickly again"). Kept in a small JSON file ({ id: timestamp }) in SCHAETZLE_DATA when that's set
// (the NAS stack mounts a volume there, so it survives a redeploy); in memory otherwise. Entries
// older than KEEP are forgotten: by then a listing counts as fresh again.

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEEP = 90 * 24 * 60 * 60_000;

/**
 * @param {{ dir?: string | null, now?: () => number, log?: (message: string) => void }} options
 */
export function createRotation({ dir = null, now = Date.now, log = (m) => console.warn(m) } = {}) {
  const path = dir ? join(dir, 'rotation.json') : null;
  /** @type {Map<string, number>} */
  const shown = new Map();
  if (path) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      for (const [id, at] of Object.entries(data ?? {})) if (typeof at === 'number' && now() - at < KEEP) shown.set(id, at);
    } catch (error) {
      if (error?.code !== 'ENOENT') log(`rotation: ${path} unreadable, starting fresh (${error.message})`);
    }
  }

  let warned = false;
  function save() {
    if (!path) return;
    try {
      // Written whole and renamed into place, so a crash mid-write never leaves half a file.
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(Object.fromEntries(shown)));
      renameSync(tmp, path);
    } catch (error) {
      if (!warned) log(`rotation: can't write ${path} (${error.message}); keeping it in memory`);
      warned = true;
    }
  }

  return {
    /** When a listing was last drawn for a game; 0 for never (or long ago). */
    lastShown(id) {
      const at = shown.get(id) ?? 0;
      return now() - at < KEEP ? at : 0;
    },
    /** These listings were just drawn for a game. */
    mark(ids) {
      const t = now();
      for (const id of ids) shown.set(id, t);
      for (const [id, at] of shown) if (t - at >= KEEP) shown.delete(id);
      save();
    },
    get size() {
      return shown.size;
    },
  };
}
