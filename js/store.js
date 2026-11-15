import { CONFIG, todayISO, shiftMonth, daysInMonth } from './format.js';

let storageAvailable = true;

/** Detects system dark mode preference safely. */
function defaultTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Returns a fresh default state object. */
function createEmptyState() {
  return {
    version: CONFIG.schemaVersion,
    currency: CONFIG.defaultCurrency,
    theme: defaultTheme(),
    selectedMonth: todayISO().slice(0, 7),
    hiddenCategories: [],
    budgets: {},
    transactions: []
  };
}

/** Migrates or normalizes loaded storage payloads to the current schema version. */
function migrateState(raw) {
  const base = createEmptyState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    version: CONFIG.schemaVersion,
    currency: CONFIG.currencies[raw.currency] ? raw.currency : base.currency,
    theme: raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : base.theme,
    selectedMonth: /^\d{4}-\d{2}$/.test(raw.selectedMonth) ? raw.selectedMonth : base.selectedMonth,
    hiddenCategories: Array.isArray(raw.hiddenCategories) ? raw.hiddenCategories : [],
    budgets: raw.budgets && typeof raw.budgets === 'object' ? raw.budgets : {},
    transactions: Array.isArray(raw.transactions) ? raw.transactions : []
  };
}

/** Loads persisted state from localStorage with graceful fallback. */
export function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    storageAvailable = true;
    return raw ? migrateState(JSON.parse(raw)) : createEmptyState();
  } catch {
    storageAvailable = false;
    return createEmptyState();
  }
}

/** Persists current state to localStorage safely. */
export function saveState(state) {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

/** Reports whether localStorage read/write succeeded. */
export function isStorageAvailable() {
  return storageAvailable;
}

/** Generates a deterministic seeded PRNG (Mulberry32) for reproducible demo data. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds 4 months of realistic seeded sample transactions and default budgets. */
export function generateDemoDataset(anchorMonth) {
  const rand = mulberry32(202611);
  const items = [];
  const samples = [
    { cat: 'Food', notes: ['Lunch cafe', 'Groceries', 'Filter coffee & snacks', 'Dinner order'], min: 18000, max: 145000 },
    { cat: 'Transport', notes: ['Metro card top-up', 'Auto rickshaw', 'Cab ride'], min: 8000, max: 65000 },
    { cat: 'Shopping', notes: ['Books & stationery', 'Apparel', 'Desk accessories'], min: 45000, max: 320000 },
    { cat: 'Health', notes: ['Pharmacy', 'Dental checkup', 'Vitamins'], min: 25000, max: 180000 },
    { cat: 'Education', notes: ['Online course', 'Exam prep guide', 'Cloud lab credits'], min: 50000, max: 250000 },
    { cat: 'Entertainment', notes: ['Movie tickets', 'Music subscription', 'Museum pass'], min: 19900, max: 95000 }
  ];

  for (let offset = -3; offset <= 0; offset += 1) {
    const mKey = shiftMonth(anchorMonth, offset);
    const [y, m] = mKey.split('-').map(Number);
    const maxDay = offset === 0 ? Math.min(daysInMonth(y, m), Number(todayISO().slice(8, 10)) || 18) : daysInMonth(y, m);

    items.push({ id: `demo-sal-${mKey}`, type: 'income', amount: 4500000, category: 'Savings', date: `${mKey}-01`, note: 'Monthly stipend / salary (Demo)' });
    items.push({ id: `demo-rent-${mKey}`, type: 'expense', amount: 1400000, category: 'Rent & Bills', date: `${mKey}-03`, note: 'Apartment rent & Wi-Fi (Demo)' });
    items.push({ id: `demo-bill-${mKey}`, type: 'expense', amount: 185000, category: 'Rent & Bills', date: `${mKey}-10`, note: 'Electricity & mobile bill (Demo)' });

    for (let i = 0; i < 18; i += 1) {
      const bucket = samples[Math.floor(rand() * samples.length)];
      const day = String(Math.max(1, Math.ceil(rand() * maxDay))).padStart(2, '0');
      const amt = Math.round((bucket.min + rand() * (bucket.max - bucket.min)) / 100) * 100;
      const note = bucket.notes[Math.floor(rand() * bucket.notes.length)];
      items.push({ id: `demo-${mKey}-${i}`, type: 'expense', amount: amt, category: bucket.cat, date: `${mKey}-${day}`, note: `${note} (Demo)` });
    }
  }

  const budgets = { Food: 800000, Transport: 300000, 'Rent & Bills': 1700000, Shopping: 500000, Health: 250000, Education: 400000, Entertainment: 250000 };
  return { transactions: items, budgets };
}