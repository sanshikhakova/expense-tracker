import { CONFIG, formatMoney, formatMonthLabel, escapeHTML, todayISO, parseISODate, toMinorUnits } from './format.js';
import { renderDonutChart, renderMonthlyBarChart, renderDailyLineChart, renderWeekdayChart, renderBudgetRing } from './charts.js';

let toastTimer = null;

/** Populates static category selects and budget inputs once at startup. */
export function initStaticControls() {
  const catOpts = CONFIG.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  document.getElementById('tx-category').innerHTML = catOpts;
  document.getElementById('filter-category').innerHTML = `<option value="all">All Categories</option>${catOpts}`;
  document.getElementById('budget-inputs').innerHTML = CONFIG.categories.map((c) => `
    <div class="budget-input-row">
      <label for="b-in-${c.id}">${c.icon} ${c.label}</label>
      <input id="b-in-${c.id}" data-cat="${c.id}" class="input-control mono" type="number" min="0" step="1" placeholder="0" style="width:130px" />
    </div>
  `).join('');
}

/** Renders the full dashboard view from computed analytics and current state. */
export function renderDashboard(state, viewData) {
  document.documentElement.dataset.theme = state.theme;
  document.getElementById('currency-select').value = state.currency;
  document.getElementById('current-month-label').textContent = formatMonthLabel(state.selectedMonth);

  const { summary, sixMonth, daily, weekday, budgetInfo, insights, groups } = viewData;
  renderInsights(insights, summary, state.currency);
  renderKPIs(summary, state.currency);
  renderCharts(summary, sixMonth, daily, weekday, state.currency);
  renderBudgets(budgetInfo, state.currency);
  renderTransactionList(groups, state.currency);
}

/** Renders auto-generated insights and the month-end projection card. */
function renderInsights(insights, summary, currency) {
  document.getElementById('insights-list').innerHTML = insights.map((line) => `<li>${escapeHTML(line)}</li>`).join('');
  document.getElementById('projection-card').innerHTML = `
    <span class="proj-label">Projected Month-End Spend</span>
    <span class="proj-value mono">${formatMoney(summary.projectedSpend, currency)}</span>
    <span class="proj-note">Calculated from ${formatMoney(summary.dailyAvg, currency)}/day over ${summary.elapsedDays} of ${summary.totalDays} days.</span>
  `;
}

/** Renders the 8 top-level KPI cards with MoM delta badges. */
function renderKPIs(s, currency) {
  const momBadge = s.momChangePct === null
    ? '<span class="kpi-delta muted-text">No prior month data</span>'
    : `<span class="kpi-delta ${s.momChangePct <= 0 ? 'delta-good' : 'delta-bad'}">${s.momChangePct >= 0 ? '▲' : '▼'} ${Math.abs(s.momChangePct)}% vs last mo</span>`;

  const cards = [
    { label: 'Total Spent', val: formatMoney(s.totalSpent, currency), extra: momBadge },
    { label: 'Total Income', val: formatMoney(s.totalIncome, currency), extra: '' },
    { label: 'Net Balance', val: formatMoney(s.netBalance, currency), extra: '' },
    { label: 'Savings Rate', val: `${s.savingsRate}%`, extra: '' },
    { label: 'Avg Daily Spend', val: formatMoney(s.dailyAvg, currency), extra: '' },
    { label: 'Median Expense', val: formatMoney(s.medianTx, currency), extra: '' },
    { label: 'Largest Expense', val: formatMoney(s.largestTx, currency), extra: '' },
    { label: 'Top Category', val: s.busiest ? `${s.busiest.icon} ${s.busiest.label}` : '—', extra: '' }
  ];
  document.getElementById('kpi-grid').innerHTML = cards.map((c) => `
    <article class="kpi-card">
      <span class="kpi-label">${c.label}</span>
      <span class="kpi-val mono">${escapeHTML(c.val)}</span>
      ${c.extra}
    </article>
  `).join('');
}

/** Renders all 4 hand-built SVG charts, interactive legend, and accessible tables. */
function renderCharts(summary, sixMonth, daily, weekday, currency) {
  document.getElementById('chart-donut').innerHTML = renderDonutChart(summary.categoryBreakdown, summary.activeTotal, currency);
  document.getElementById('donut-legend').innerHTML = summary.categoryBreakdown.map((c) => `
    <button type="button" class="legend-chip ${c.hidden ? 'is-hidden' : ''}" data-cat="${c.id}" aria-pressed="${!c.hidden}">
      <span class="dot" style="background:${c.color}"></span>${escapeHTML(c.label)} (${c.pct}%)
    </button>
  `).join('');

  document.getElementById('chart-monthly').innerHTML = renderMonthlyBarChart(sixMonth, currency);
  document.getElementById('chart-daily').innerHTML = renderDailyLineChart(daily, currency);
  document.getElementById('chart-weekday').innerHTML = renderWeekdayChart(weekday, currency);

  document.getElementById('table-donut').innerHTML = `<table><caption>Category Breakdown</caption>${summary.categoryBreakdown.map((c) => `<tr><td>${escapeHTML(c.label)}</td><td>${formatMoney(c.amount, currency)}</td></tr>`).join('')}</table>`;
  document.getElementById('table-weekday').innerHTML = `<table><caption>Weekday Spending</caption>${weekday.map((w) => `<tr><td>${w.label}</td><td>${formatMoney(w.amount, currency)}</td></tr>`).join('')}</table>`;
}

/** Renders the overall budget ring and per-category progress bars. */
function renderBudgets(budgetInfo, currency) {
  const { rows, totalBudget, totalUsed } = budgetInfo;
  document.getElementById('budget-ring-wrap').innerHTML = totalBudget > 0
    ? `${renderBudgetRing(totalUsed, totalBudget)}<div><strong>Overall Monthly Budget</strong><p class="muted-text">${formatMoney(totalUsed, currency)} spent of ${formatMoney(totalBudget, currency)} limit</p></div>`
    : `<p class="muted-text">No monthly budgets configured yet. Click <strong>Edit Limits</strong> to set category caps.</p>`;

  document.getElementById('budget-list').innerHTML = rows.map((r) => `
    <div class="budget-item">
      <div class="budget-meta">
        <span>${r.icon} <strong>${escapeHTML(r.label)}</strong></span>
        <span class="mono">${escapeHTML(r.statusText)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${r.isOver ? 'is-over' : r.isWarn ? 'is-warn' : ''}" style="width:${Math.min(100, r.pct)}%"></div>
      </div>
    </div>
  `).join('');
}

/** Renders date-grouped transactions or a helpful empty state. */
function renderTransactionList(groups, currency) {
  const container = document.getElementById('tx-list');
  if (!groups.length) {
    container.innerHTML = `<div class="empty-state">
      <p><strong>No matching transactions found</strong></p>
      <p class="muted-text">Add your first expense or populate 4 months of sample data to explore the dashboard.</p>
    </div>`;
    return;
  }

  const catMap = Object.fromEntries(CONFIG.categories.map((c) => [c.id, c]));
  container.innerHTML = groups.map((g) => `
    <div class="day-group">
      <div class="day-header">
        <span>${escapeHTML(g.date)}</span>
        <span class="mono">${g.subtotal >= 0 ? '+' : ''}${formatMoney(g.subtotal, currency)}</span>
      </div>
      ${g.items.map((tx) => {
        const cat = catMap[tx.category] || CONFIG.categories[8];
        return `<div class="tx-row" data-id="${escapeHTML(tx.id)}">
          <div class="tx-main">
            <span class="cat-badge" style="background:${cat.color}" aria-hidden="true">${cat.icon}</span>
            <div>
              <span class="tx-title">${escapeHTML(tx.category)}</span>
              <span class="tx-note">${escapeHTML(tx.note || 'No note')}</span>
            </div>
          </div>
          <div class="tx-right">
            <span class="tx-amount mono ${tx.type === 'income' ? 'is-income' : 'is-expense'}">${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount, currency)}</span>
            <button type="button" class="icon-btn" data-action="edit" aria-label="Edit transaction">✎</button>
            <button type="button" class="icon-btn" data-action="delete" aria-label="Delete transaction">🗑</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

/** Opens the add/edit transaction modal populated with existing data or defaults. */
export function openTxModal(tx = null) {
  const modal = document.getElementById('tx-modal');
  document.getElementById('tx-modal-title').textContent = tx ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('tx-id').value = tx ? tx.id : '';
  document.getElementById('tx-amount').value = tx ? (tx.amount / 100).toFixed(2) : '';
  document.getElementById('tx-category').value = tx ? tx.category : 'Food';
  document.getElementById('tx-date').value = tx ? tx.date : todayISO();
  document.getElementById('tx-note').value = tx ? tx.note : '';
  setFormType(tx ? tx.type : 'expense');
  clearFormErrors();
  modal.hidden = false;
  document.getElementById('tx-amount').focus();
}

/** Sets active visual state on the Expense/Income toggle buttons. */
export function setFormType(type) {
  document.querySelectorAll('#tx-form .toggle-opt').forEach((btn) => {
    const active = btn.dataset.type === type;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

/** Validates transaction form fields and returns parsed payload or null. */
export function validateTxForm() {
  clearFormErrors();
  const rawAmt = document.getElementById('tx-amount').value.trim();
  const date = document.getElementById('tx-date').value.trim();
  const note = document.getElementById('tx-note').value.trim();
  const minor = toMinorUnits(rawAmt);
  let ok = true;

  if (!rawAmt || !Number.isFinite(minor) || minor <= 0 || !/^\d+(\.\d{1,2})?$/.test(rawAmt)) {
    document.getElementById('err-amount').textContent = 'Enter a positive amount with up to 2 decimal places.';
    ok = false;
  }
  if (!parseISODate(date)) {
    document.getElementById('err-date').textContent = 'Select a valid calendar date.';
    ok = false;
  }
  if (note.length > 80) {
    document.getElementById('err-note').textContent = 'Note must be 80 characters or fewer.';
    ok = false;
  }
  if (!ok) return null;

  const type = document.querySelector('#tx-form .toggle-opt.is-active')?.dataset.type || 'expense';
  return {
    id: document.getElementById('tx-id').value || `tx-${Date.now()}`,
    type,
    amount: minor,
    category: document.getElementById('tx-category').value,
    date,
    note
  };
}

function clearFormErrors() {
  ['err-amount', 'err-date', 'err-note'].forEach((id) => { document.getElementById(id).textContent = ''; });
}

/** Displays a temporary toast message with an optional Undo callback button. */
export function showToast(message, onUndo = null) {
  const region = document.getElementById('toast-region');
  clearTimeout(toastTimer);
  region.innerHTML = `<div class="toast"><span>${escapeHTML(message)}</span>${onUndo ? '<button type="button" id="toast-undo-btn">Undo</button>' : ''}</div>`;
  if (onUndo) document.getElementById('toast-undo-btn').addEventListener('click', () => { clearTimeout(toastTimer); region.innerHTML = ''; onUndo(); });
  toastTimer = setTimeout(() => { region.innerHTML = ''; }, 5000);
}

/** Positions and displays the floating chart tooltip clamped inside the viewport. */
export function showChartTooltip(text, clientX, clientY) {
  const tip = document.getElementById('chart-tooltip');
  tip.textContent = text;
  tip.hidden = false;
  const rect = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - rect.width - 12, Math.max(12, clientX + 12));
  const top = Math.min(window.innerHeight - rect.height - 12, Math.max(12, clientY - 32));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

/** Hides the floating chart tooltip. */
export function hideChartTooltip() {
  document.getElementById('chart-tooltip').hidden = true;
}