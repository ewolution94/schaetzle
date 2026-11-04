import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// What Schätzle hands Dashboard (public/ewo.config.json), checked with Folio's own rules, and the
// order a setting is decided in: this device's own choice, then Dashboard's default, then the
// built-in one (src/lib/defaults.ts, and public/boot.js before first paint).
import { checkManifest, resolve } from '../vendor/ewo/elements/config-core.js';
import { languageFor, themeFor } from '../src/lib/defaults.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/ewo.config.json', import.meta.url), 'utf8'));

test('the manifest is one Dashboard takes: the family’s language and theme', () => {
  const { ok, problems, manifest: checked } = checkManifest(manifest);
  assert.deepEqual(problems, []);
  assert.ok(ok);
  assert.equal(checked.app, 'schaetzle');
  assert.deepEqual(Object.keys(checked.settings), ['lang', 'theme']);
});

test('with nothing set in Dashboard, both follow the device: the page as it ships', () => {
  const { values, sources } = resolve(manifest, {});
  assert.deepEqual(values, { lang: 'system', theme: 'system' });
  assert.deepEqual(sources, { lang: 'built-in', theme: 'built-in' });
  assert.equal(themeFor('system', values.theme), 'system');
  assert.equal(languageFor('system', values.lang, 'de'), 'de');
  assert.equal(languageFor('system', values.lang, 'en'), 'en');
});

test('Dashboard’s family default and this app’s own value reach the page', () => {
  assert.deepEqual(resolve(manifest, { family: { theme: 'dark', lang: 'en' } }).values, { lang: 'en', theme: 'dark' });
  assert.deepEqual(resolve(manifest, { family: { theme: 'dark', lang: 'en' }, app: { theme: 'light', lang: 'de' } }).values, { lang: 'de', theme: 'light' });
  // A value the family doesn't have falls back to the built-in one.
  assert.deepEqual(resolve(manifest, { family: { theme: 'purple', lang: 'fr' } }).values, { lang: 'system', theme: 'system' });
});

test('the device’s own choice beats Dashboard’s default, which beats the built-in one', () => {
  assert.equal(themeFor('light', 'dark'), 'light');
  assert.equal(themeFor('system', 'dark'), 'dark');
  assert.equal(themeFor('system', 'system'), 'system');
  assert.equal(themeFor('system', 'purple'), 'system');
  // QA's `ewo:lang` = `en` is this device's own choice, so it keeps winning.
  assert.equal(languageFor('en', 'de', 'de'), 'en');
  assert.equal(languageFor('system', 'en', 'de'), 'en');
  assert.equal(languageFor('system', 'system', 'de'), 'de');
  assert.equal(languageFor('system', undefined, 'en'), 'en');
});

/** public/boot.js against a stub page: the theme and language it applies before first paint. */
function boot({ saved = {}, config, languages = ['de-DE', 'de'] }) {
  const root = { dataset: {}, lang: 'de', classList: { add() {}, remove() {} }, style: { setProperty() {} } };
  const metas = [
    { content: '#09090b', media: '(prefers-color-scheme: dark)' },
    { content: '#f5f4f1', media: '(prefers-color-scheme: light)' },
  ];
  const document = {
    documentElement: root,
    getElementById: (id) => (id === 'ewo-config' && config ? { textContent: JSON.stringify(config) } : null),
    querySelectorAll: () => metas,
    addEventListener() {},
  };
  const localStorage = { getItem: (key) => saved[key] ?? null };
  vm.runInNewContext(readFileSync(new URL('../public/boot.js', import.meta.url), 'utf8'), {
    document,
    localStorage,
    matchMedia: () => ({ matches: false }),
    navigator: { languages, language: languages[0] },
    location: { search: '' },
    screen: {},
    addEventListener() {},
    setTimeout() {},
  });
  return { theme: root.dataset.theme, lang: root.lang, colors: metas.map((m) => m.content) };
}

test('before first paint: the saved theme and language, else Dashboard’s, else the system’s', () => {
  // Nothing saved, no Dashboard: today's page (the system's theme, the browser's language).
  assert.deepEqual(boot({}), { theme: undefined, lang: 'de', colors: ['#09090b', '#f5f4f1'] });
  assert.deepEqual(boot({ languages: ['fr-FR', 'en-GB'] }), { theme: undefined, lang: 'en', colors: ['#09090b', '#f5f4f1'] });
  assert.equal(boot({ languages: ['fr-FR'] }).lang, 'en');
  assert.deepEqual(boot({ config: { lang: 'system', theme: 'system' } }), { theme: undefined, lang: 'de', colors: ['#09090b', '#f5f4f1'] });
  // Dashboard's values on a device that hasn't picked.
  assert.deepEqual(boot({ config: { lang: 'en', theme: 'dark' } }), { theme: 'dark', lang: 'en', colors: ['#09090b', '#09090b'] });
  // The device's own picks win, `ewo:lang` = `en` (QA's) among them.
  assert.deepEqual(boot({ saved: { 'ewo:theme': 'light', 'ewo:lang': 'en' }, config: { lang: 'de', theme: 'dark' } }), {
    theme: 'light',
    lang: 'en',
    colors: ['#f5f4f1', '#f5f4f1'],
  });
  assert.equal(boot({ saved: { 'ewo:lang': 'de' }, config: { lang: 'en' }, languages: ['en-US'] }).lang, 'de');
});
