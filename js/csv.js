import { CONFIG, toMinorUnits, parseISODate } from './format.js';

/** Escapes a single CSV field according to RFC-4180 rules. */
function escapeCSVField(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Serializes an array of transaction objects into a valid CSV string. */
export function serializeTransactionsCSV(transactions) {
  const header = 'id,date,type,category,amount,note';
  const rows = transactions.map((tx) => [
    escapeCSVField(tx.id),
    escapeCSVField(tx.date),
    escapeCSVField(tx.type),
    escapeCSVField(tx.category),
    escapeCSVField((tx.amount / 100).toFixed(2)),
    escapeCSVField(tx.note)
  ].join(','));
  return [header, ...rows].join('\n');
}

/** Parses a single CSV line handling quoted commas and escaped double quotes. */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Parses and validates uploaded CSV text, returning valid rows and row-level errors. */
export function parseTransactionsCSV(csvText) {
  const lines = String(csvText || '').replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { valid: [], errors: ['CSV file is empty or missing data rows.'], totalRows: 0 };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    date: headers.indexOf('date'),
    type: headers.indexOf('type'),
    category: headers.indexOf('category'),
    amount: headers.indexOf('amount'),
    note: headers.indexOf('note')
  };

  if (idx.date === -1 || idx.category === -1 || idx.amount === -1) {
    return { valid: [], errors: ['Missing required header columns: date, category, amount.'], totalRows: lines.length - 1 };
  }

  const validCatIds = new Set(CONFIG.categories.map((c) => c.id));
  const valid = [];
  const errors = [];

  for (let r = 1; r < lines.length; r += 1) {
    const cols = parseCSVLine(lines[r]);
    const dateStr = (cols[idx.date] || '').trim();
    const typeStr = idx.type >= 0 ? (cols[idx.type] || 'expense').trim().toLowerCase() : 'expense';
    const catStr = (cols[idx.category] || '').trim();
    const minor = toMinorUnits(cols[idx.amount]);
    const noteStr = idx.note >= 0 ? (cols[idx.note] || '').trim().slice(0, 80) : '';

    if (!parseISODate(dateStr)) { errors.push(`Row ${r + 1}: Invalid date "${dateStr}".`); continue; }
    if (typeStr !== 'expense' && typeStr !== 'income') { errors.push(`Row ${r + 1}: Invalid type "${typeStr}".`); continue; }
    if (!validCatIds.has(catStr)) { errors.push(`Row ${r + 1}: Unknown category "${catStr}".`); continue; }
    if (!Number.isFinite(minor) || minor <= 0) { errors.push(`Row ${r + 1}: Amount must be > 0.`); continue; }

    valid.push({
      id: `imp-${Date.now()}-${r}`,
      date: dateStr,
      type: typeStr,
      category: catStr,
      amount: minor,
      note: noteStr
    });
  }

  return { valid, errors, totalRows: lines.length - 1 };
}