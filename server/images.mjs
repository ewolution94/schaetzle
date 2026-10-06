// Product photos, passed through our own origin.
//
// The browser only ever talks to Schätzle: eBay never sees the players' addresses, the CSP stays
// 'self', and strict tracking protection (Firefox) can't blank the photos, which it does for
// i.ebayimg.com on guess-the-price.net.
//
// Not an open proxy: the eBay source registers each photo and gets back an opaque /img/<id>;
// only registered ids are served, only from i.ebayimg.com, and every entry is forgotten after 6
// hours (eBay's limit for showing listing data). Bodies are kept in memory while a game uses
// them, so ten players loading the same photo cost one request to eBay.

import { randomBytes } from 'node:crypto';

const TTL = 6 * 60 * 60_000;
const ALLOWED = /^https:\/\/i\.ebayimg\.com\//;
const MAX_BYTES = 6 * 1024 * 1024;
/** Memory for photo bodies; the oldest go first. */
const CACHE_BYTES = 96 * 1024 * 1024;
const TIMEOUT = 10_000;

/**
 * @param {{ fetch?: typeof globalThis.fetch, now?: () => number }} [options]
 */
export function createImages({ fetch = globalThis.fetch, now = Date.now } = {}) {
  /** @type {Map<string, { candidates: string[], expires: number, body?: Promise<{ type: string, data: Buffer } | null> }>} */
  const entries = new Map();
  let cached = 0;

  function sweep() {
    const t = now();
    for (const [id, entry] of entries) if (entry.expires <= t) forget(id);
  }

  function forget(id) {
    const entry = entries.get(id);
    if (!entry) return;
    entries.delete(id);
    void entry.body?.then((body) => {
      if (body) cached -= body.data.length;
    });
  }

  /** Make room by dropping the oldest bodies (the entries stay; they'd be fetched again). */
  async function trim() {
    for (const entry of entries.values()) {
      if (cached <= CACHE_BYTES) return;
      if (!entry.body) continue;
      const body = await entry.body;
      entry.body = undefined;
      if (body) cached -= body.data.length;
    }
  }

  async function load(candidates) {
    for (const url of candidates) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
        const type = response.headers.get('content-type') ?? '';
        if (!response.ok || !type.startsWith('image/')) continue;
        const data = Buffer.from(await response.arrayBuffer());
        if (data.length > MAX_BYTES) continue;
        return { type, data };
      } catch {
        // the next candidate, or nothing
      }
    }
    return null;
  }

  return {
    /** @param {string[]} candidates  photo URLs, best first  @returns {string} the path to use instead */
    register(candidates) {
      sweep();
      const allowed = candidates.filter((url) => ALLOWED.test(url));
      const id = randomBytes(12).toString('base64url');
      if (allowed.length) entries.set(id, { candidates: allowed, expires: now() + TTL });
      return `/img/${id}`;
    },

    get size() {
      return entries.size;
    },

    /**
     * Answers /img/<id>.
     * @param {import('node:http').IncomingMessage} req
     * @param {import('node:http').ServerResponse} res
     * @returns {Promise<boolean>} true when the request was ours
     */
    async handle(req, res) {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      if (!pathname.startsWith('/img/')) return false;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return true;
      }
      sweep();
      const entry = entries.get(pathname.slice(5));
      if (!entry) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
        return true;
      }
      if (!entry.body) {
        entry.body = load(entry.candidates);
        void entry.body.then((body) => {
          if (!body) {
            // Don't keep a failure: the next request tries eBay again.
            if (entries.get(pathname.slice(5)) === entry) entry.body = undefined;
            return;
          }
          cached += body.data.length;
          void trim();
        });
      }
      const body = await entry.body;
      if (!body) {
        res.writeHead(502, { 'content-type': 'text/plain' }).end('Photo unavailable');
        return true;
      }
      const left = Math.max(0, Math.floor((entry.expires - now()) / 1000));
      res.writeHead(200, {
        'content-type': body.type,
        'content-length': body.data.length,
        'cache-control': `private, max-age=${left}`,
      });
      res.end(req.method === 'HEAD' ? undefined : body.data);
      return true;
    },
  };
}
