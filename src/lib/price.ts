// Prices as people type them and as the game shows them: `5,80€`, `1.250€` in both languages
// (learnings/ui-preferences.md → Formats).

const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 389 → "389€", 5.8 → "5,80€", 1249.99 → "1.249,99€". */
export function formatPrice(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? whole.format(rounded) : cents.format(rounded)}€`;
}

/** What the guess field keeps of what's typed or pasted: digits, commas and dots, nothing else. */
export const priceChars = (text: string) => text.replace(/[^\d.,]/g, '');

/**
 * What someone typed, as euros; null when it isn't a price. German and English habits both work:
 * "1.250" and "1250" are 1250, "12,50" and "12.50" are 12.5, "1.249,99" and "1,249.99" too.
 */
export function parsePrice(text: string): number | null {
  const raw = text.replace(/[\s€]|eur(o)?/gi, '');
  if (!/^\d[\d.,]*$/.test(raw) && !/^[.,]\d+$/.test(raw)) return null;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  let normal: string;
  if (comma > -1 && dot > -1) {
    // Both: the last one is the decimal separator.
    const decimal = comma > dot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    normal = raw.split(thousands).join('').replace(decimal, '.');
  } else if (comma > -1) {
    // German decimals, unless it's clearly thousands ("1,250,000").
    normal = /^\d{1,3}(,\d{3}){2,}$/.test(raw) ? raw.replaceAll(',', '') : raw.replace(',', '.');
  } else if (dot > -1) {
    // "1.250" is German thousands; "12.5" and "12.50" are decimals.
    normal = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replaceAll('.', '') : raw;
  } else {
    normal = raw;
  }
  if ((normal.match(/\./g) ?? []).length > 1) return null;
  const value = Number(normal);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

/** 0.12 → "+12 %", -0.3 → "−30 %". Under 1 % shows one decimal. */
export function formatDeviation(value: number, lang: 'de' | 'en'): string {
  const pct = value * 100;
  const abs = Math.abs(pct);
  const digits = abs < 1 && abs > 0 ? 1 : 0;
  const text = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: digits }).format(abs);
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '±';
  return `${sign}${text}${lang === 'de' ? ' %' : '%'}`;
}

export const formatPoints = (value: number) => whole.format(value);
