// The game over HTTP: JSON for moves, Server-Sent Events for the live room.
//
//   GET  /api/config                     what the start screen needs (demo or live items)
//   POST /api/rooms            {name, avatar?, key?}   a new room; you're its host → {code, player, token}
//   GET  /api/rooms/:code                does it exist, is it full → {code, phase, players, full}
//   POST /api/rooms/:code/join {name, avatar?, token?, key?}   a seat (the same one again with your token)
//   GET  /api/rooms/:code/events?p=<id>  the room's view, now and after every change (SSE)
//   POST /api/rooms/:code/<action>       settings, start, guess, joker, skip, next, rematch, team, shuffle,
//                                        kick, leave, avatar, end
//                                        with your token in `x-schaetzle-token`
//   GET  /api/rooms/:code/events         without `p`: the same stream for the big screen (/:code/screen)
//
// Why SSE and not WebSockets: everything the server pushes is one small JSON view, moves are rare
// (a guess every few seconds), Node has no WebSocket server built in, and SSE already runs through
// Cloudflare's tunnel for Pulse. No dependencies, same as every server here.
//
// Errors are `{ "error": "<code>" }` with a status; the codes are GameError's and the client
// words them.

import { GameError, ROUND_CHOICES, SECOND_CHOICES, JOKER_CHOICES, MODES, TEAM_CHOICES, DEFAULT_SETTINGS } from './game.mjs';
import { PRICES, THEME_KEYS } from './items/themes.mjs';

const MAX_BODY = 4096;
/** Cloudflare drops a stream that's quiet for 100 s. */
const HEARTBEAT = 20_000;
const ROOM_PATH = /^\/api\/rooms\/([A-Za-z]{4})(?:\/([a-z]+))?$/;

/**
 * @param {{ games: ReturnType<typeof import('./game.mjs').createGames>, demo: boolean }} options
 */
export function createApi({ games, demo }) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const streams = new Set();

  function json(res, status, body) {
    const text = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(text),
    });
    res.end(text);
  }

  async function readJson(req) {
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) throw new GameError('json', 415);
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new GameError('too-large', 413);
      chunks.push(chunk);
    }
    if (!size) return {};
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return body && typeof body === 'object' ? body : {};
    } catch {
      throw new GameError('json');
    }
  }

  function events(req, res, code, playerId) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 4000\n\n');
    streams.add(res);
    let unsubscribe = () => {};
    const send = (data) => {
      if (!res.writableEnded) res.write(`data: ${data}\n\n`);
    };
    try {
      unsubscribe = games.subscribe(code, playerId, send);
    } catch (error) {
      send(JSON.stringify({ code: String(code).toUpperCase(), phase: 'gone' }));
      streams.delete(res);
      res.end();
      return;
    }
    const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT);
    beat.unref?.();
    const done = () => {
      clearInterval(beat);
      streams.delete(res);
      unsubscribe();
    };
    req.on('close', done);
    res.on('error', done);
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @returns {Promise<boolean>} true when the request was ours (anything under /api/)
   */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return false;

    try {
      if (pathname === '/api/config') {
        if (req.method !== 'GET') throw new GameError('method', 405);
        json(res, 200, {
          demo,
          themes: THEME_KEYS,
          prices: Object.keys(PRICES),
          rounds: ROUND_CHOICES,
          seconds: SECOND_CHOICES,
          jokers: JOKER_CHOICES,
          modes: MODES,
          teams: TEAM_CHOICES,
          defaults: DEFAULT_SETTINGS,
        });
        return true;
      }

      if (pathname === '/api/rooms') {
        if (req.method !== 'POST') throw new GameError('method', 405);
        const body = await readJson(req);
        json(res, 201, games.create({ name: body.name, avatar: body.avatar, key: body.key }));
        return true;
      }

      const match = ROOM_PATH.exec(pathname);
      if (!match) throw new GameError('not-found', 404);
      const [, code, action] = match;

      if (!action) {
        if (req.method !== 'GET') throw new GameError('method', 405);
        const info = games.info(code);
        if (!info) throw new GameError('no-room', 404);
        json(res, 200, info);
        return true;
      }

      if (action === 'events') {
        if (req.method !== 'GET') throw new GameError('method', 405);
        events(req, res, code, url.searchParams.get('p'));
        return true;
      }

      if (req.method !== 'POST') throw new GameError('method', 405);
      const body = await readJson(req);
      if (action === 'join') {
        json(res, 200, games.join(code, { name: body.name, avatar: body.avatar, token: body.token, key: body.key }));
        return true;
      }
      await games.act(code, req.headers['x-schaetzle-token'], action, body);
      res.writeHead(204, { 'cache-control': 'no-store' }).end();
      return true;
    } catch (error) {
      if (error instanceof GameError) {
        if (!res.headersSent) json(res, error.status, { error: error.code });
        return true;
      }
      throw error;
    }
  }

  return {
    handle,
    /** Ends every open stream, so shutdown doesn't wait for them (learnings/node-server.md). */
    close() {
      for (const res of streams) res.end();
      streams.clear();
    },
  };
}
