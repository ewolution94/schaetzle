# Schätzle

Guess the price of real eBay listings, together: a party game for our afternoon meeting, in the
spirit of [guess-the-price.net](https://guess-the-price.net/). Live at
[schaetzle.ewolution.cloud](https://schaetzle.ewolution.cloud).

> **Demo items for now.** Until the eBay keys are set, games draw from a built-in list of 95
> made-up listings with estimated prices, and the game says "Demo" wherever it matters. Setting
> `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` switches to live ebay.de listings without a code change
> ([eBay](#ebay) below).

- **Start a game, share the link.** A room gets a four-letter code (no vowels, so no code spells a
  word) and a link like `schaetzle.ewolution.cloud/KXPT`, with a QR code for the meeting room's
  screen. No accounts: a name is enough, and a reload or a locked phone puts you back in your seat.
- **Four modes**, picked in the lobby:
  - **Guess the price** (*Schätzen*): the classic, scored by the ratio (below).
  - **Don't go over** (*Der Preis ist heiß*): the same, but a guess over the price scores nothing,
    and "closest" means closest without going over.
  - **Higher or lower** (*Teurer oder billiger*): each item against the one before it, whose price
    shows. One tap answers. Right scores 500, plus up to 500 more the closer the two prices are
    (`500 + 500 × max(0, 1 − |log₂(price ÷ last)| ÷ 3)`); wrong scores 0. The game opens with an
    extra item to compare against, and neighbours are always at least 10 % apart.
  - **Sort** (*Sortieren*): four items a round, tapped from cheapest to priciest (a second tap takes
    a place back). Each of the six pairs in the right order is a sixth of 1,000, so one swap of
    neighbours still scores 833. No two prices in a round are within 10 % of each other. Picking it
    lifts a timer under 60 seconds to 60.
- **Teams** (off, 2, 3 or 4), with any mode: everyone is spread over the teams in turn, newcomers
  join the smallest, anyone can switch in the lobby, and the host can shuffle. A team scores its
  players' average each round, so a team of two can beat a team of five. The reveal and the end show
  the teams' standings; the players' own ranking stays.
- **The big screen** (`/KXPT/screen`, linked in the lobby): the room for a projector or a shared
  screen in a call. It watches without a seat (never a player, no controls) and fits the screen
  without scrolling: a big QR code and the players arriving in the lobby, the item, the timer and who
  is in during a round, the reveal and the standings, the winner. It keeps the display awake where the
  browser allows it.
- **The host sets the game:** the mode, 5, 10 or 15 rounds, 20 to 90 seconds per round, a price range (up to
  50€, up to 500€, anything), 0 to 3 jokers per player, teams, any mix of themes to draw from (Tech, Home,
  Kitchen, Fashion, Toys, Collectibles, Sport & outdoors, Garden & tools, Oddities; at least one to
  start), and whether the title shows. Changes show on the host's screen the moment they're tapped
  and reach the others a moment later.
- **A round:** the photos to swipe through, the condition and the title, a price field that takes
  `1.250`, `12,50` or `12.50`, and a timer. You see who has locked in, not what. The round ends
  when everyone online has guessed, or when the time is up. The host can swap the item for a spare.
- **Jokers:** instead of guessing, a player can play a joker (a second tap confirms it): the round
  scores the full 1,000 points. Until the reveal it looks like any other guess; a joker played on an
  item the host skips goes back to its player. Rematches refill them.
- **The reveal:** the real price lands on the photo as a red price tag, every guess appears on a
  price line around it, and each player gets their points, how far off they were, and their total.
  On a live item there's a link to the listing.
- **The end:** a podium, the full ranking, every round's item with its price and who came closest,
  and "Play again" for the same group.
- **Scoring** (guess the price) looks at the ratio, because prices are multiplicative: `1000 × (1 − |log₂(guess ÷
  price)|)`, at least 0. Too high and too low by the same factor score the same; half or double the
  price scores nothing; 10 % off scores about 850. Within 2 % is a "Bullseye". Speed doesn't count.
  The round's red highlight and the recap's "closest" go to the best real guess, never a joker.
- **Settings** (the sliders button in the bar) hold General, the same in every ewolution app:
  Language (System, Deutsch, English) and Theme (System, Light, Dark), both following the system
  until picked; a change fades in under a short blur. Installs to a home screen.

## How it works

The server holds every game in memory (`server/game.mjs`): rooms, players, rounds and the clock.
Moves are small JSON requests; each room's state goes out to its players over Server-Sent Events,
the whole view each time something changes.

- **Why SSE and not WebSockets:** the server pushes one small view, players send a guess every few
  seconds, Node has no WebSocket server built in, and SSE already runs through Cloudflare's tunnel
  for Pulse. The page reconnects by itself with backoff (`src/lib/room.svelte.ts`), and the stream
  sends a heartbeat every 20 seconds, so Cloudflare never drops a quiet one.
- **Nobody sees a price early.** During a round the view has no price; it arrives with the reveal.
  Guesses are hidden too: you only see who has guessed. The one price that shows is higher or
  lower's item to compare against, which was revealed the round before (or opens the game).
- **Modes are dealt at the start** (`dealItems` in `server/game.mjs`): the drawn items become the
  rounds' items in order, the spares for skips, and for higher or lower the opening item. Sorting
  draws four items a round and still costs the same five eBay calls (four searches of 50 listings).
  A skip deals a new item, or four when sorting; higher or lower's spare is one far enough from both
  neighbours.
- **The host's settings are optimistic:** the lobby shows a change at once and sends changes one
  request at a time (merging what piles up meanwhile), so quick taps can't overtake each other; the
  server's view takes over once it agrees, and a refusal falls back to it with a message.
- **Seats:** joining returns a player id and a secret token, kept in the browser per room. Moves
  carry the token; the stream only needs the id (it says who's online).
- **The host's seat moves on** after the host has been gone 15 seconds; people who close the page
  in the lobby leave the list after a minute; an empty room is forgotten after half an hour. A
  deploy (a restart) ends every game in progress.
- **Items** come from `server/items/`: `ebay.mjs` (live) or `mock.mjs` (demo), picked by
  `index.mjs`. The themes are curated keyword lists (`themes.mjs`), and a blocklist keeps listings
  out of a work meeting that have no place there. The host can skip an item anyway.
- **Photos go through our own origin** (`server/images.mjs`): the browser only ever talks to
  Schätzle, so the CSP stays `'self'`, eBay never sees the players' addresses, and strict tracking
  protection can't blank them. Only photos the eBay source registered are served, only from
  `i.ebayimg.com`, and every entry is forgotten after 6 hours.
- **The look** is the family's (Folio's tokens, Geist, the dot field), with OTTO's red, ink and
  palette from OTTO's public design tokens: the red for the price, OTTO's soft colours for the
  players and the demo items. No OTTO logo or font: this is a game, not an OTTO product.
- **Visit counts** go to [Census](https://github.com/ewolution94/census), the self-hosted counter on
  the NAS: no cookies, nothing stored on the device. `server/census.mjs` forwards `/_e.js` and `/_e`
  to it over the shared Docker network, adding only `X-Site: schaetzle`. Without
  `SCHAETZLE_CENSUS` (local runs) the forwarder answers with an empty beacon and counts nothing.

## eBay

The live source uses eBay's [Browse API](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search)
on ebay.de: fixed-price listings located in Germany, priced in euros, in the chosen range, never
"for parts or not working". One game costs about five calls (a token, reused for two hours, and four
searches); eBay's default limit is 5,000 a day, and the server stops itself at 4,000.

To switch it on:

1. Create a developer account at [developer.ebay.com](https://developer.ebay.com/) (approval can
   take a day) and a **production** keyset.
2. Under *Alerts & Notifications*, opt out of marketplace account deletion notifications with
   "I do not persist eBay data". That's true here: items live in a game's memory, and photos are
   forgotten after 6 hours (eBay's limit for showing listing data). The keyset stays inactive until
   this is done.
3. Set `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` in the Portainer stack's environment variables
   (never in the stack file) and redeploy the stack. The lobby's "Demo" badge disappears.

eBay's current docs call production Buy API access "intended for eBay partners". If the keyset is
refused, the game shows "Couldn't load any items (auth)" in the lobby; `SCHAETZLE_SOURCE=mock`
switches back to the demo items with the keys still set. `tests/ebay.test.mjs` uses a response
shaped like eBay's documentation; replace it with a captured real one once the keys work.

## Run it

```bash
npm install
npm run dev          # http://localhost:5810, the game server included (5800 is the NAS port)
npm run check        # svelte-check / TypeScript
npm test             # unit tests: the game, scoring, prices, the eBay source, Census (Node 24+)
npm run build && npm start   # production server on :8080 (or --port 5811)
```

With `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` in the environment, the dev server draws live
listings too.

## Deploy (NAS)

This mirrors Cantina, Atrium and Aale Spiele:

- `ci.yml` runs the typecheck, the tests and the build, then smoke-tests the production server
  (page, headers, a room, a second player, a started game on the live stream).
- `docker-publish.yml` gates on `ci.yml`, then pushes `ghcr.io/ewolution94/schaetzle:latest` for
  amd64 and arm64.
- The shared Watchtower picks the image up. With this setup, a push to `release` is the whole deploy,
  and it ends any game in progress: don't push during the afternoon meeting.
- The NAS runs `deploy/portainer-stack.yml`, on port **5800**.
- The stack joins the external Docker network `ewolution`, where Census listens as `census:4901`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `--port` | `8080` | Listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | empty | eBay production keyset; both set means live listings |
| `SCHAETZLE_SOURCE` | | `mock` forces the demo items even with keys |
| `SCHAETZLE_CENSUS` | off | Census's ingest origin, `http://census:4901` on the NAS |

## Project layout

```
server/server.mjs         static files + security headers, wires the rest; no dependencies
server/game.mjs           rooms, players, rounds, the clock (no I/O; tested with a fake clock)
server/api.mjs            the game over HTTP: JSON moves, the SSE stream
server/scoring.mjs        points for a guess, a pick (higher or lower) and an order (sort)
server/images.mjs         product photos through our origin
server/items/             ebay.mjs (live), mock.mjs (demo), themes.mjs (keywords, ranges, blocklist)
server/census.mjs         forwards /_e.js and /_e to Census (visit counts)
src/lib/room.svelte.ts    the live room: the stream, reconnects, moves
src/lib/price.ts          reading and showing prices (5,80€)
src/components/           Home, Join, Game → Lobby, Round, Reveal, Final; Screen (the big screen);
                          SortBoard, Anchor, TeamBoard, PriceTag, PriceLine, Media, Thumb, Qr
public/sw.js              offline shell (never the game's /api/ or /img/)
brand/                    the mark and app icons (public/icons/ is rendered from them)
vendor/ewo/               Folio's tokens, fonts and elements (npm run vendor -- schaetzle in Folio)
```
