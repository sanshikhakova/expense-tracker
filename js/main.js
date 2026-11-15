import { CONFIG, shiftMonth, toMinorUnits } from './format.js';
import { loadState, saveState, isStorageAvailable, generateDemoDataset } from './store.js';
import { filterTransactions, groupTransactionsByDate, computeMonthlySummary, computeSixMonthSeries, computeDailySeries, computeWeekdaySeries, computeBudgetProgress, generateInsights } from './analytics.js';
import { serializeTransactionsCSV, parseTransactionsCSV } from './csv.js';
import { initStaticControls, renderDashboard, openTxModal, setFormType, validateTxForm, showToast, showChartTooltip, hideChartTooltip } from './ui.js';

let state = loadState();
const filters = { search: '', category: 'all', type: 'all', range: 'selected', sort: 'date-desc', from: '', to: '' };
let pendingImport = [];

/** Recomputes analytics from current state and refreshes the dashboard UI. */
function refresh() {
  saveState(state);
  document.getElementById('storage-warning').hidden = isStorageAvailable();
  const summary = computeMonthlySummary(state.transactions, state.selectedMonth, state.hiddenCategories);
  const sixMonth = computeSixMonthSeries(state.transactions, state.selectedMonth);
  const daily = computeDailySeries(state.transactions, state.selectedMonth);
  const weekday = computeWeekdaySeries(state.transactions, state.selectedMonth);
  const budgetInfo = computeBudgetProgress(summary.byCategory, state.budgets, state.currency);
  const insights = generateInsights(summary, budgetInfo, weekday, state.currency);
  const groups = groupTransactionsByDate(filterTransactions(state.transactions, filters, state.selectedMonth), filters.sort);
  renderDashboard(state, { summary, sixMonth, daily, weekday, budgetInfo, insights, groups });
}

/** Binds all delegated UI, form, chart tooltip, CSV, and keyboard events once. */
function bindEvents() {
  document.getElementById('btn-prev-month').addEventListener('click', () => { state.selectedMonth = shiftMonth(state.selectedMonth, -1); refresh(); });
  document.getElementById('btn-next-month').addEventListener('click', () => { state.selectedMonth = shiftMonth(state.selectedMonth, 1); refresh(); });
  document.getElementById('currency-select').addEventListener('change', (e) => { state.currency = e.target.value; refresh(); });
  document.getElementById('btn-theme').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; refresh(); });
  document.getElementById('btn-open-add').addEventListener('click', () => openTxModal());
  document.getElementById('fab-add').addEventListener('click', () => openTxModal());
  document.getElementById('btn-close-tx-modal').addEventListener('click', () => { document.getElementById('tx-modal').hidden = true; });
  document.getElementById('btn-cancel-tx').addEventListener('click', () => { document.getElementById('tx-modal').hidden = true; });
  document.querySelectorAll('#tx-form .toggle-opt').forEach((b) => b.addEventListener('click', () => setFormType(b.dataset.type)));

  document.getElementById('tx-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const entry = validateTxForm();
    if (!entry) return;
    const idx = state.transactions.findIndex((t) => t.id === entry.id);
    if (idx >= 0) state.transactions[idx] = entry;
    else state.transactions.push(entry);
    state.selectedMonth = entry.date.slice(0, 7);
    document.getElementById('tx-modal').hidden = true;
    refresh();
  });

  document.getElementById('tx-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('.tx-row').dataset.id;
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    if (btn.dataset.action === 'edit') openTxModal(tx);
    if (btn.dataset.action === 'delete') {
      state.transactions = state.transactions.filter((t) => t.id !== id);
      refresh();
      showToast('Transaction deleted.', () => { state.transactions.push(tx); refresh(); });
    }
  });

  document.getElementById('donut-legend').addEventListener('click', (e) => {
    const chip = e.target.closest('.legend-chip');
    if (!chip) return;
    const cat = chip.dataset.cat;
    state.hiddenCategories = state.hiddenCategories.includes(cat) ? state.hiddenCategories.filter((c) => c !== cat) : [...state.hiddenCategories, cat];
    refresh();
  });

  ['filter-search', 'filter-category', 'filter-type', 'filter-range', 'filter-sort', 'filter-from', 'filter-to'].forEach((id) => {
    document.getElementById(id).addEventListener('input', (e) => {
      const key = id.replace('filter-', '');
      filters[key] = e.target.value;
      document.getElementById('custom-date-row').hidden = filters.range !== 'custom';
      refresh();
    });
  });

  document.getElementById('btn-demo').addEventListener('click', () => {
    const demo = generateDemoDataset(state.selectedMonth);
    state.transactions = demo.transactions;
    state.budgets = demo.budgets;
    refresh();
    showToast('Loaded 4 months of reproducible demo data.');
  });

  document.getElementById('btn-edit-budgets').addEventListener('click', () => {
    CONFIG.categories.forEach((c) => { document.getElementById(`b-in-${c.id}`).value = state.budgets[c.id] ? (state.budgets[c.id] / 100) : ''; });
    document.getElementById('budget-modal').hidden = false;
  });
  document.getElementById('btn-close-budget-modal').addEventListener('click', () => { document.getElementById('budget-modal').hidden = true; });
  document.getElementById('btn-cancel-budget').addEventListener('click', () => { document.getElementById('budget-modal').hidden = true; });
  document.getElementById('budget-form').addEventListener('submit', (e) => {
    e.preventDefault();
    CONFIG.categories.forEach((c) => { state.budgets[c.id] = Math.max(0, toMinorUnits(document.getElementById(`b-in-${c.id}`).value) || 0); });
    document.getElementById('budget-modal').hidden = true;
    refresh();
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const blob = new Blob([serializeTransactionsCSV(state.transactions)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-lens-${state.selectedMonth}.csv`;
    a.click();
  });
  document.getElementById('input-import-csv').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = parseTransactionsCSV(await file.text());
    pendingImport = res.valid;
    document.getElementById('import-summary').innerHTML = `<p><strong>${res.valid.length}</strong> valid rows ready to import (${res.errors.length} rejected).</p>${res.errors.slice(0, 5).map((err) => `<p class="danger-text">${err}</p>`).join('')}`;
    document.getElementById('import-modal').hidden = false;
    e.target.value = '';
  });
  document.getElementById('btn-confirm-import').addEventListener('click', () => { state.transactions.push(...pendingImport); document.getElementById('import-modal').hidden = true; refresh(); showToast(`Imported ${pendingImport.length} transactions.`); });
  ['btn-close-import', 'btn-cancel-import'].forEach((id) => document.getElementById(id).addEventListener('click', () => { document.getElementById('import-modal').hidden = true; }));

  document.getElementById('btn-clear-all').addEventListener('click', () => { document.getElementById('clear-modal').hidden = false; });
  document.getElementById('btn-cancel-clear').addEventListener('click', () => { document.getElementById('clear-modal').hidden = true; });
  document.getElementById('btn-confirm-clear').addEventListener('click', () => { state.transactions = []; state.budgets = {}; document.getElementById('clear-modal').hidden = true; refresh(); });

  document.addEventListener('mousemove', (e) => { const t = e.target.closest('[data-tip]'); t ? showChartTooltip(t.dataset.tip, e.clientX, e.clientY) : hideChartTooltip(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ['tx-modal', 'budget-modal', 'import-modal', 'clear-modal'].forEach((id) => { document.getElementById(id).hidden = true; });
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); openTxModal(); }
    if (e.key === '/') { e.preventDefault(); document.getElementById('filter-search').focus(); }
  });
}

initStaticControls();
bindEvents();
refresh();