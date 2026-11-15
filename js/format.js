export const CONFIG = {
  storageKey: 'budget_lens_state_v1',
  schemaVersion: 1,
  defaultCurrency: 'INR',
  currencies: {
    INR: { locale: 'en-IN', symbol: '₹' },
    USD: { locale: 'en-US', symbol: '$' },
    EUR: { locale: 'de-DE', symbol: '€' },
    GBP: { locale: 'en-GB', symbol: '£' }
  },
  categories: [
    { id: 'Food', label: 'Food', color: '#4f46e5', icon: '🍽️' },
    { id: 'Transport', label: 'Transport', color: '#0284c7', icon: '🚇' },
    { id: 'Rent & Bills', label: 'Rent & Bills', color: '#0d9488', icon: '🏠' },
    { id: 'Shopping', label: 'Shopping', color: '#d97706', icon: '🛍️' },
    { id: 'Health', label: 'Health', color: '#dc2626', icon: '🩺' },
    { id: 'Education', label: 'Education', color: '#7c3aed', icon: '📚' },
    { id: 'Entertainment', label: 'Entertainment', color: '#db2777', icon: '🎬' },
    { id: 'Savings', label: 'Savings', color: '#059669', icon: '🏦' },
    { id: 'Other', label: 'Other', color: '#64748b', icon: '📦' }
  ],
  chartSizes: {
    donut: { size: 240, stroke: 34 },
    bar: { width: 540, height: 240 },
    line: { width: 620, height: 230 },
    weekday: { width: 320, height: 230 }
  }
};

/** Converts a decimal currency value or string into integer minor units (paise/cents). */
export function toMinorUnits(amount) {
  const num = typeof amount === 'string' ? Number(amount.trim()) : Number(amount);
  if (!Number.isFinite(num)) return NaN;
  return Math.round(num * 100);
}

/** Formats integer minor units into a localized currency string. */
export function formatMoney(minorUnits, currencyCode = CONFIG.defaultCurrency) {
  const cfg = CONFIG.currencies[currencyCode] || CONFIG.currencies.INR;
  const major = (Number(minorUnits) || 0) / 100;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: major % 1 === 0 ? 0 : 2
  }).format(major);
}

/** Formats compact axis numbers (e.g., 12k) in the active currency symbol. */
export function formatCompact(minorUnits, currencyCode = CONFIG.defaultCurrency) {
  const cfg = CONFIG.currencies[currencyCode] || CONFIG.currencies.INR;
  const major = Math.round((Number(minorUnits) || 0) / 100);
  if (Math.abs(major) >= 100000) return `${cfg.symbol}${(major / 100000).toFixed(1)}L`;
  if (Math.abs(major) >= 1000) return `${cfg.symbol}${(major / 1000).toFixed(0)}k`;
  return `${cfg.symbol}${major}`;
}

/** Returns today's local calendar date as an ISO YYYY-MM-DD string. */
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD into integer year, month (1-12), and day without timezone shifts. */
export function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Returns the exact number of calendar days in a given year and 1-indexed month. */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Shifts a YYYY-MM month key by delta months across year boundaries cleanly. */
export function shiftMonth(monthKey, delta) {
  const [yStr, mStr] = monthKey.split('-');
  const totalMonths = Number(yStr) * 12 + (Number(mStr) - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Formats YYYY-MM as a human-readable Month Year heading. */
export function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[m - 1]} ${y}`;
}

/** Returns weekday index (0 = Mon ... 6 = Sun) for an ISO YYYY-MM-DD string. */
export function weekdayIndex(iso) {
  const p = parseISODate(iso);
  if (!p) return 0;
  const jsDay = new Date(p.year, p.month - 1, p.day).getDay();
  return (jsDay + 6) % 7;
}

/** Escapes unsafe HTML characters to prevent XSS in rendered notes/categories. */
export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}