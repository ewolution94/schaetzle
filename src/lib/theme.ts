// Light / dark, on Folio's `ewo:theme` (theme-toggle.js): the pick stored on this device, else
// Dashboard's theme for a device that hasn't picked (#ewo-config, src/lib/defaults.ts), else the
// system's. public/boot.js applies the same before first paint; keep the colours in step with it.

import { readConfig } from '../../vendor/ewo/elements/config-client.js';
import { setTheme, type ThemeChoice } from '../../vendor/ewo/elements/theme-toggle.js';
import { themeFor } from './defaults';

/** What Default shows here: Dashboard's theme, or the system's. */
export function defaultTheme(): 'light' | 'dark' {
  const set = themeFor('system', readConfig().theme);
  if (set !== 'system') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Stores the pick (Default removes it) and shows it: Default shows Dashboard's theme where it set one. */
export function applyTheme(choice: ThemeChoice) {
  setTheme(choice);
  const shown = themeFor(choice, readConfig().theme);
  if (shown === choice) return;
  // Default with Dashboard's theme: pinned on the page like a pick, but not stored as one.
  document.documentElement.dataset.theme = shown;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = shown === 'light' ? '#f5f4f1' : '#09090b';
  // setTheme announced the system's theme; the field (src/lib/field.ts) reads it again.
  dispatchEvent(new CustomEvent('ewo-theme', { detail: { choice, theme: shown } }));
}
