// The live room: the server's view of it, pushed over Server-Sent Events, and the moves you send.
//
// EventSource gives up for good after one error page (Cloudflare's 502 during a deploy), so it
// reconnects itself, with backoff, and right away when the tab comes back or the network returns
// (learnings/node-server.md).

import { api, type Seat, type View } from './api';

const BACKOFF = [1000, 2000, 4000, 8000, 15000];
/** A live stream that sends nothing for this long has died without an error (plans/live-connection.md). */
const STALE = 45_000;

export class Room {
  /** Replaced whole on every message, so it stays raw (no deep proxy to compare against). */
  view: View | null = $state.raw(null);
  /** The stream is open. */
  live = $state(false);
  /** It has been open before: a closed stream now is a reconnect, not the first connect. */
  wasLive = $state(false);
  /** Server clock minus ours, for the countdown. */
  offset = $state(0);

  #source: EventSource | null = null;
  #attempt = 0;
  #timer = 0;
  #closed = false;
  /** The last sign of life on the stream: a view, any event, or the server's heartbeat. */
  #last = 0;
  #watch = 0;
  /** The last few clock readings; the largest has the least network delay in it. */
  #samples: number[] = [];
  #ready = new Set<() => void>();

  constructor(readonly seat: Seat) {}

  connect() {
    this.#closed = false;
    addEventListener('online', this.#wake);
    document.addEventListener('visibilitychange', this.#wake);
    // EventSource only notices a dead stream when an error comes, which a phone changing networks may
    // never send: one that stays quiet past two heartbeats is reopened.
    clearInterval(this.#watch);
    this.#watch = window.setInterval(() => {
      if (!this.#closed && this.live && Date.now() - this.#last > STALE) this.#revive();
    }, 10_000);
    this.#open();
  }

  close() {
    this.#closed = true;
    clearTimeout(this.#timer);
    clearInterval(this.#watch);
    this.#source?.close();
    this.#source = null;
    this.live = false;
    removeEventListener('online', this.#wake);
    document.removeEventListener('visibilitychange', this.#wake);
  }

  /** A move; throws ApiError with the server's reason. `signal`: from track(), which may give up. */
  act(action: string, body?: unknown, signal?: AbortSignal) {
    return api.act(this.seat, action, body, signal);
  }

  /** Resolves with the first view (the room is ready to show); rejects when `signal` gives up. */
  ready(signal?: AbortSignal) {
    if (this.view) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const done = () => {
        this.#ready.delete(done);
        resolve();
      };
      this.#ready.add(done);
      signal?.addEventListener(
        'abort',
        () => {
          this.#ready.delete(done);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  /** Milliseconds left until a server timestamp. */
  left(at: number, now = Date.now()) {
    return Math.max(0, at - (now + this.offset));
  }

  #open() {
    clearTimeout(this.#timer);
    this.#source?.close();
    const source = new EventSource(`/api/rooms/${this.seat.code}/events?p=${encodeURIComponent(this.seat.player)}`);
    this.#source = source;
    this.#last = Date.now();
    source.addEventListener('ping', () => (this.#last = Date.now()));
    source.onopen = () => {
      this.#attempt = 0;
      this.#last = Date.now();
      this.live = true;
      this.wasLive = true;
    };
    source.onmessage = (event) => {
      this.#last = Date.now();
      let view: View;
      try {
        view = JSON.parse(event.data);
      } catch {
        return;
      }
      if (typeof view.now === 'number') {
        // The largest of the last few readings (the least delay in it), so countdowns don't jitter.
        this.#samples.push(view.now - Date.now());
        if (this.#samples.length > 8) this.#samples.shift();
        this.offset = Math.max(...this.#samples);
      }
      this.view = view;
      for (const done of [...this.#ready]) done();
      if (view.phase === 'gone') this.close();
    };
    source.onerror = () => {
      source.close();
      if (this.#source !== source) return;
      this.#source = null;
      this.live = false;
      if (this.#closed) return;
      const wait = BACKOFF[Math.min(this.#attempt++, BACKOFF.length - 1)];
      this.#timer = window.setTimeout(() => this.#open(), wait);
    };
  }

  /** A stream that went quiet without an error: reopen it, and show the reconnect meanwhile. */
  #revive() {
    this.live = false;
    this.#attempt = 0;
    this.#open();
  }

  #wake = () => {
    if (this.#closed || document.visibilityState === 'hidden') return;
    // A live stream stays, unless it has been quiet longer than a heartbeat (back from the background).
    if (this.live && Date.now() - this.#last < 25_000) return;
    this.#attempt = 0;
    this.#open();
  };
}
