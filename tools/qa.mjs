// Schätzle in a browser, every screen a game reaches: home, Settings, the avatar maker, the join page,
// the lobby (host and guest), a round, a locked guess, the reveal and the results, in every mode
// (teams in one of them), the joker, "This game" in Settings and a game ended early, and the big
// screen at desktop widths. The host and a guest play in pages; two bots play through the API with a
// stream each, so they count as online (learnings/projects/schaetzle.md). Shots go to the out dir;
// console errors, sideways overflow and (with AUDIT) the text checks are listed at the end.
//
//   node tools/qa.mjs [base] [outdir]     W=390 H=844 LANG_UI=de ENGINE=webkit ROUNDS=5 by default
//   MODES=classic,hot node tools/qa.mjs … only these modes (classic, hot, higher, sort)
//   AUDIT=1 node tools/qa.mjs …           every shot also checks that text sits in the middle of its box
//                                         that stacked lines sit there as a block, and that numbers keep
//                                         full-height digits (tools/text-audit.mjs)
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digitAudit, stackAudit, textAudit } from './text-audit.mjs';

// Playwright lives in Folio's node_modules (development/folio), wherever this checkout sits.
let up = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(up, 'folio/node_modules/playwright/index.mjs'))) {
  if (dirname(up) === up) throw new Error('Playwright not found: development/folio/node_modules/playwright');
  up = dirname(up);
}
const playwright = await import(pathToFileURL(join(up, 'folio/node_modules/playwright/index.mjs')).href);

const BASE = (process.argv[2] ?? 'http://localhost:5810').replace(/\/$/, '');
const OUT = process.argv[3] ?? '/tmp/schaetzle-qa/';
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const LANG = process.env.LANG_UI ?? 'de';
const ENGINE = process.env.ENGINE ?? 'webkit';
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const MODES = (process.env.MODES ?? 'classic,hot,higher,sort').split(',');
/** Text off its box's middle by this many px or more, at every shot (tools/text-audit.mjs). */
const AUDIT = process.env.AUDIT ? Number(process.env.AUDIT) : 0;
// Not centred on purpose: the podium's numbers stand at the top of their steps; a team's name stands
// on its coloured rule (an underline, not a box); higher or lower's reveal heads each side with its
// way, over the avatars who picked it (a side nobody picked has only its heading).
const AUDIT_SKIP = ['.podium .step', '.team > header', '.side-of'];
// Stacked lines that aren't a label's: the lobby's mode buttons stretch to their grid row and keep their
// names at the top, in line across the row; cards hold a heading over a paragraph (the card's padding,
// the paragraph's own leading below its last line); a result row's columns stand beside its avatar, and
// the bullseye badge over the points is a box of its own.
const STACK_SKIP = [...AUDIT_SKIP, '.modes > .mode', '.card.settings', '.mode-card', '.results > li'];
const desktop = W >= 1000;
mkdirSync(OUT, { recursive: true });

const problems = [];
const offCentre = new Map();
const offStack = new Map();
const oldDigits = new Map();
const say = (line) => console.log(line);
const browser = await playwright[ENGINE].launch();

async function person(label, size = { width: W, height: H }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: LANG === 'de' ? 'de-DE' : 'en-US' });
  await context.addInitScript((lang) => {
    try {
      localStorage.setItem('ewo:lang', lang);
    } catch {}
  }, LANG);
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`${label}: ${e.message}`));
  page.on('console', (m) => {
    // A photo eBay no longer serves is the photo's problem, not the page's.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`${label}: ${m.text()}`);
  });
  return { label, context, page };
}

/** Until nothing but endless loops (the waiting tag's swing) is still moving, at most 3 s. */
async function settle(page) {
  await page.waitForFunction(
    () => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity),
    null,
    { timeout: 3000, polling: 100 },
  ).catch(() => {});
}

let shot = 0;
/** `quick`: a passing state (a button still waiting), shot as it is. */
async function snap(p, label, { quick = false } = {}) {
  if (!quick) {
    await settle(p.page);
    await p.page.waitForTimeout(250);
  }
  const name = `${String(++shot).padStart(2, '0')}-${p.label}-${label}`;
  await p.page.screenshot({ path: `${OUT}${name}.png` });
  const wide = await p.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (wide > 0) problems.push(`${name}: ${wide} px wider than the screen`);
  if (!AUDIT) return;
  for (const row of await p.page.evaluate(textAudit, { min: AUDIT, skip: AUDIT_SKIP })) {
    const key = `${row.where} | ${row.text.replace(/\d+/g, '#')}`;
    if (!offCentre.has(key)) offCentre.set(key, { ...row, at: name });
  }
  for (const row of await p.page.evaluate(stackAudit, { min: AUDIT, skip: STACK_SKIP })) {
    const key = `${row.where} | ${row.text.replace(/\d+/g, '#')}`;
    if (!offStack.has(key)) offStack.set(key, { ...row, at: name });
  }
  for (const row of await p.page.evaluate(digitAudit)) {
    const key = `${row.where} | ${row.text.replace(/\d+/g, '#')}`;
    if (!oldDigits.has(key)) oldDigits.set(key, { ...row, at: name });
  }
}

async function api(path, body, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-schaetzle-token': token } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** A player through the API, online with a stream of its own; `view` is the room as it sees it. */
async function bot(code, name, avatar) {
  const seat = await api(`/rooms/${code}/join`, { name, avatar });
  const b = { name, seat, view: null, stop: new AbortController() };
  const res = await fetch(`${BASE}/api/rooms/${code}/events?p=${seat.player}`, { signal: b.stop.signal });
  (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) > -1) {
          const event = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = event.split('\n').find((l) => l.startsWith('data: '));
          if (data && !/^event: ping/m.test(event)) b.view = JSON.parse(data.slice(6));
        }
      }
    } catch {
      // stopped
    }
  })();
  return b;
}

/** A seat's guess for the round on screen, whatever the mode. */
async function guess(code, token, view) {
  const round = view.round;
  const body =
    round.mode === 'higher'
      ? { pick: Math.random() < 0.5 ? 'higher' : 'lower' }
      : round.mode === 'sort'
        ? { order: round.items.map((i) => i.id).sort(() => Math.random() - 0.5) }
        : { value: Math.round((5 + Math.random() * 150) * 100) / 100 };
  await api(`/rooms/${code}/guess`, body, token);
}

const seatOf = (p, code) => p.page.evaluate((c) => JSON.parse(localStorage.getItem(`schaetzle:seat:${c}`)), code);
/** The view a page's seat sees, from the server (the page keeps its own out of reach). */
const viewOf = async (b, n) => {
  for (let i = 0; i < 100; i++) {
    if (b.view?.round?.n === n && b.view.phase === 'guess') return b.view;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`${b.name}: no view of round ${n}`);
};

// ---- the screens before a game -------------------------------------------------------------------

const host = await person('host');
await host.page.goto(BASE, { waitUntil: 'load' });
await host.page.waitForSelector('section.home');
await snap(host, 'home');
await host.page.locator('ewo-settings-button').click();
await host.page.waitForTimeout(500);
await snap(host, 'settings');
await host.page.keyboard.press('Escape');
await host.page.waitForTimeout(500);
await host.page.locator('form.create .trigger').click();
await host.page.waitForTimeout(500);
await snap(host, 'maker');
await host.page.keyboard.press('Escape');
await host.page.waitForTimeout(500);
await host.page.locator('#code').fill('KXPT');
await host.page.locator('#name').fill('Anna');
await snap(host, 'home-filled');
await host.page.locator('form.create .btn.primary').click();
await host.page.waitForSelector('section.lobby');
const code = new URL(host.page.url()).pathname.slice(1);
const hostSeat = await seatOf(host, code);
say(`room ${code} at ${W}×${H}, ${LANG}, ${ENGINE}`);

const guest = await person('guest');
await guest.page.goto(`${BASE}/${code}`, { waitUntil: 'load' });
await guest.page.waitForSelector('section.join');
await snap(guest, 'join');
await guest.page.locator('section.join input').fill('Ben');
await guest.page.locator('section.join .btn.primary').click();
await guest.page.waitForSelector('section.lobby');
const guestSeat = await seatOf(guest, code);

const bots = [await bot(code, 'Cleo', [3, 2, 5]), await bot(code, 'Dario Benedetti', [7, 5, 12])];

let screen = null;
if (desktop) {
  screen = await person('screen', { width: 1280, height: 720 });
  await screen.page.goto(`${BASE}/${code}/screen`, { waitUntil: 'load' });
  await screen.page.waitForSelector('div.screen');
}

await snap(host, 'lobby');
await snap(guest, 'lobby');
if (screen) await snap(screen, 'lobby');
// The QR code is behind a button on a phone (on a wider screen it shows anyway).
if (await host.page.locator('.qr-toggle').isVisible()) {
  await host.page.locator('.qr-toggle').click();
  await snap(host, 'lobby-qr');
  await host.page.locator('.qr-toggle').click();
}
// The pill under the bar while the connection is back to find (WebKit keeps an open stream through
// Playwright's setOffline, so the pill is told directly).
await guest.page.evaluate(() => document.querySelector('ewo-connection').setAttribute('state', 'reconnecting'));
await guest.page.waitForSelector('ewo-connection[data-show]', { timeout: 5000 }).catch(() => problems.push('guest: no connection pill'));
await snap(guest, 'reconnecting');
await guest.page.evaluate(() => document.querySelector('ewo-connection').setAttribute('state', 'online'));

/** The next request to `action` answers `ms` later, so its button shows how it waits. */
async function slow(p, action, ms) {
  await p.page.route(`**/api/rooms/*/${action}`, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue().catch(() => {});
  }, { times: 1 });
}

// ---- the games ----------------------------------------------------------------------------------

for (const [m, mode] of MODES.entries()) {
  const last = m === MODES.length - 1;
  await api(`/rooms/${code}/settings`, { mode, rounds: ROUNDS, seconds: 90, jokers: 1, teams: mode === 'hot' ? 2 : 0 }, hostSeat.token);
  await host.page.waitForTimeout(400);
  await snap(host, `${mode}-lobby`);
  if (mode === 'hot') await snap(guest, `${mode}-lobby`);
  // The first start answers late: the button's tag, its words after 1.2 s, "takes longer" after 6 s.
  if (m === 0) await slow(host, 'start', 7000);
  await host.page.locator('section.lobby .start .btn.primary').click();
  if (m === 0) {
    await host.page.waitForTimeout(1600);
    await snap(host, `${mode}-starting`, { quick: true });
    await snap(guest, `${mode}-starting`, { quick: true });
    await host.page.waitForTimeout(4800);
    await snap(host, `${mode}-starting-slow`, { quick: true });
  }

  for (let n = 1; n <= ROUNDS; n++) {
    await host.page.waitForSelector('section.round', { timeout: 15000 });
    const view = await viewOf(bots[0], n);
    // One bot in first, so the row of players shows a tick.
    await guess(code, bots[0].seat.token, view);
    const first = n === 1;
    if (first) {
      await snap(host, `${mode}-round`);
      if (screen) await snap(screen, `${mode}-round`);
    }
    if (m === 0 && first) {
      // A refused move answers with a toast.
      await host.page.route('**/api/rooms/*/skip', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"no-spares"}' }), { times: 1 });
      if (await host.page.locator('.btn.quiet.skip').count()) {
        await host.page.locator('.btn.quiet.skip').click();
        await host.page.waitForTimeout(600);
        await snap(host, `${mode}-toast`, { quick: true });
      } else problems.push(`${mode}: no skip button for the host`);
      // The guess answers late too.
      await slow(host, 'guess', 2500);
    }
    // The host: a joker in the first mode's second round (its second tap confirms), else a guess.
    if (m === 0 && n === 2) {
      await host.page.locator('.btn.joker').click();
      await snap(host, `${mode}-joker-confirm`);
      await host.page.locator('.btn.joker').click();
    } else if (mode === 'higher') {
      await host.page.locator('.btn.pick.higher').click();
    } else if (mode === 'sort') {
      for (const item of await host.page.locator('.board button.item').all()) await item.click();
      if (first) await snap(host, `${mode}-sorted`);
      await host.page.locator('.sort-actions .btn.primary').click();
    } else {
      await host.page.locator('#guess').fill(n % 2 ? '49,90' : '1.250');
      if (first) await snap(host, `${mode}-typed`);
      await host.page.locator('form.guess .btn.primary').click();
      if (m === 0 && first) {
        await host.page.waitForTimeout(1600);
        await snap(host, `${mode}-submitting`, { quick: true });
      }
    }
    await host.page.waitForSelector('.locked');
    if (first) await snap(host, `${mode}-locked`);
    if (last && first) {
      // "This game" in Settings: the host ends it, after a second tap.
      await host.page.locator('ewo-settings-button').click();
      await host.page.waitForTimeout(500);
      await snap(host, `${mode}-settings`);
      await host.page.locator('ewo-sheet .btn.secondary', { hasText: /beenden|End/ }).click();
      await snap(host, `${mode}-end-sure`);
      await host.page.locator('ewo-sheet .btn.primary').click();
      break;
    }
    await guess(code, guestSeat.token, view);
    await guess(code, bots[1].seat.token, view);
    await host.page.waitForSelector('section.reveal');
    if (first || n === ROUNDS) {
      await snap(host, `${mode}-reveal-${n}`);
      if (first) await snap(guest, `${mode}-reveal`);
      if (screen && first) await snap(screen, `${mode}-reveal`);
    }
    await host.page.locator('section.reveal .btn.primary').click();
  }

  await host.page.waitForSelector('section.final');
  await snap(host, `${mode}-final`);
  if (m === 0 || last) await snap(guest, `${mode}-final`);
  if (screen) await snap(screen, `${mode}-final`);
  if (!last) {
    await host.page.locator('section.final .btn.primary').click();
    await host.page.waitForSelector('section.lobby');
  }
}

for (const b of bots) b.stop.abort();
await browser.close();
if (offCentre.size)
  problems.push(
    `text off the middle of its box in ${offCentre.size} places (px, + low, − high; bias: the font's own share):\n  ${[...offCentre.values()]
      .sort((a, b) => Math.abs(b.off) - Math.abs(a.off))
      .map((r) => `${r.off > 0 ? '+' : ''}${r.off} (bias ${r.bias}) ${r.where} "${r.text}" ${r.font} h${r.height} @${r.at}`)
      .join('\n  ')}`,
  );
if (offStack.size)
  problems.push(
    `stacked lines off the middle of their box in ${offStack.size} places (px, + low, − high):\n  ${[...offStack.values()]
      .sort((a, b) => Math.abs(b.off) - Math.abs(a.off))
      .map((r) => `${r.off > 0 ? '+' : ''}${r.off} ${r.where} "${r.text}" ${r.lines} lines h${r.height} @${r.at}`)
      .join('\n  ')}`,
  );
if (oldDigits.size)
  problems.push(`old-style digits (a font: shorthand drops lining-nums) in ${oldDigits.size} places:\n  ${[...oldDigits.values()].map((r) => `${r.where} "${r.text}" ${r.font} [${r.numeric}] @${r.at}`).join('\n  ')}`);
say(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no problems');
process.exit(problems.length ? 1 : 0);
