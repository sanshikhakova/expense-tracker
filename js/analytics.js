import { CONFIG, shiftMonth, daysInMonth, todayISO, weekdayIndex, formatMoney } from './format.js';

/** Filters transactions by search text, category, type, and date window. */
export function filterTransactions(transactions, filters, selectedMonth) {
  const q = (filters.search || '').trim().toLowerCase();
  const prevMonth = shiftMonth(selectedMonth, -1);
  const today = todayISO();
  const thirtyAgo = shiftDateByDays(today, -30);

  return transactions.filter((tx) => {
    if (filters.category !== 'all' && tx.category !== filters.category) return false;
    if (filters.type !== 'all' && tx.type !== filters.type) return false;
    if (filters.range === 'selected' && !tx.date.startsWith(selectedMonth)) return false;
    if (filters.range === 'lastMonth' && !tx.date.startsWith(prevMonth)) return false;
    if (filters.range === 'last30' && (tx.date < thirtyAgo || tx.date > today)) return false;
    if (filters.range === 'custom') {
      if (filters.from && tx.date < filters.from) return false;
      if (filters.to && tx.date > filters.to) return false;
    }
    if (q && !tx.note.toLowerCase().includes(q) && !tx.category.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Shifts an ISO YYYY-MM-DD date string by delta days cleanly. */
function shiftDateByDays(iso, deltaDays) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Sorts transactions and groups them by ISO date with daily net subtotals. */
export function groupTransactionsByDate(transactions, sortBy = 'date-desc') {
  const sorted = [...transactions].sort((a, b) => {
    if (sortBy === 'date-asc') return a.date.localeCompare(b.date);
    if (sortBy === 'amount-desc') return b.amount - a.amount;
    if (sortBy === 'amount-asc') return a.amount - b.amount;
    if (sortBy === 'category-asc') return a.category.localeCompare(b.category);
    return b.date.localeCompare(a.date);
  });

  if (!sortBy.startsWith('date')) {
    const subtotal = sorted.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    return [{ date: 'Filtered Results', subtotal, items: sorted }];
  }

  const map = new Map();
  sorted.forEach((tx) => {
    if (!map.has(tx.date)) map.set(tx.date, { date: tx.date, subtotal: 0, items: [] });
    const grp = map.get(tx.date);
    grp.subtotal += tx.type === 'income' ? tx.amount : -tx.amount;
    grp.items.push(tx);
  });
  return [...map.values()];
}

/** Computes median of an array of numbers safely. */
export function computeMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Computes all monthly KPIs, MoM deltas, category totals, and linear projections. */
export function computeMonthlySummary(allTransactions, selectedMonth, hiddenCategories = []) {
  const monthTx = allTransactions.filter((t) => t.date.startsWith(selectedMonth));
  const prevMonth = shiftMonth(selectedMonth, -1);
  const prevTx = allTransactions.filter((t) => t.date.startsWith(prevMonth));

  const expenses = monthTx.filter((t) => t.type === 'expense');
  const incomes = monthTx.filter((t) => t.type === 'income');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const prevSpent = prevTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const netBalance = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100) : 0;
  const momChangePct = prevSpent > 0 ? Math.round(((totalSpent - prevSpent) / prevSpent) * 100) : null;

  const [y, m] = selectedMonth.split('-').map(Number);
  const totalDays = daysInMonth(y, m);
  const today = todayISO();
  const elapsedDays = today.startsWith(selectedMonth) ? Math.max(1, Number(today.slice(8, 10))) : totalDays;
  const dailyAvg = Math.round(totalSpent / elapsedDays);
  const projectedSpend = today.startsWith(selectedMonth) ? dailyAvg * totalDays : totalSpent;

  const byCategory = {};
  CONFIG.categories.forEach((c) => { byCategory[c.id] = 0; });
  expenses.forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  const categoryBreakdown = CONFIG.categories.map((c) => ({
    ...c,
    amount: byCategory[c.id] || 0,
    hidden: hiddenCategories.includes(c.id)
  })).filter((c) => c.amount > 0);

  const activeTotal = categoryBreakdown.filter((c) => !c.hidden).reduce((s, c) => s + c.amount, 0);
  categoryBreakdown.forEach((c) => {
    c.pct = activeTotal > 0 && !c.hidden ? Math.round((c.amount / activeTotal) * 100) : 0;
  });

  const sortedCat = [...categoryBreakdown].sort((a, b) => b.amount - a.amount);
  const busiest = sortedCat[0] || null;
  const largestTx = expenses.reduce((max, t) => (t.amount > max ? t.amount : max), 0);
  const medianTx = computeMedian(expenses.map((t) => t.amount));

  return {
    totalSpent, totalIncome, netBalance, savingsRate, momChangePct,
    dailyAvg, projectedSpend, elapsedDays, totalDays,
    medianTx, largestTx, busiest, byCategory, categoryBreakdown, activeTotal
  };
}

/** Computes last 6 months income vs expense totals ending at selectedMonth. */
export function computeSixMonthSeries(allTransactions, selectedMonth) {
  const series = [];
  for (let i = 5; i >= 0; i -= 1) {
    const mKey = shiftMonth(selectedMonth, -i);
    const slice = allTransactions.filter((t) => t.date.startsWith(mKey));
    const income = slice.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = slice.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    series.push({ month: mKey, label: mKey.slice(5), income, expense });
  }
  return series;
}

/** Computes daily expense totals across all days of selectedMonth. */
export function computeDailySeries(allTransactions, selectedMonth) {
  const [y, m] = selectedMonth.split('-').map(Number);
  const days = daysInMonth(y, m);
  const totals = Array.from({ length: days }, (_, idx) => ({ day: idx + 1, amount: 0 }));
  allTransactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(selectedMonth))
    .forEach((t) => {
      const d = Number(t.date.slice(8, 10));
      if (d >= 1 && d <= days) totals[d - 1].amount += t.amount;
    });
  const sum = totals.reduce((s, d) => s + d.amount, 0);
  const avg = days > 0 ? Math.round(sum / days) : 0;
  const peak = totals.reduce((best, cur) => (cur.amount > best.amount ? cur : best), { day: 1, amount: 0 });
  return { days: totals, avg, peak };
}

/** Computes spending totals by weekday (Mon-Sun) for the selected month. */
export function computeWeekdaySeries(allTransactions, selectedMonth) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const totals = names.map((label) => ({ label, amount: 0 }));
  allTransactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(selectedMonth))
    .forEach((t) => { totals[weekdayIndex(t.date)].amount += t.amount; });
  return totals;
}

/** Evaluates per-category and overall budget progress statuses. */
export function computeBudgetProgress(byCategory, budgets, currency) {
  const rows = [];
  let totalBudget = 0;
  let totalUsed = 0;

  CONFIG.categories.forEach((cat) => {
    const limit = Number(budgets[cat.id]) || 0;
    if (limit <= 0) return;
    const spent = byCategory[cat.id] || 0;
    totalBudget += limit;
    totalUsed += spent;
    const pct = Math.round((spent / limit) * 100);
    const diff = limit - spent;
    const statusText = diff >= 0 ? `${formatMoney(diff, currency)} left` : `Over by ${formatMoney(Math.abs(diff), currency)}`;
    rows.push({ ...cat, limit, spent, pct, statusText, isWarn: pct >= 80 && pct <= 100, isOver: pct > 100 });
  });

  return { rows, totalBudget, totalUsed };
}

/** Generates 3-4 plain-English insights directly from computed monthly numbers. */
export function generateInsights(summary, budgetInfo, weekdaySeries, currency) {
  if (summary.totalSpent === 0 && summary.totalIncome === 0) {
    return ['No transactions recorded for this month yet. Add an entry or load demo data to inspect trends.'];
  }
  const lines = [];
  if (summary.busiest && summary.totalSpent > 0) {
    const share = Math.round((summary.busiest.amount / summary.totalSpent) * 100);
    const deltaText = summary.momChangePct !== null
      ? ` Overall spending is ${summary.momChangePct >= 0 ? 'up' : 'down'} ${Math.abs(summary.momChangePct)}% from last month.`
      : '';
    lines.push(`${summary.busiest.label} accounts for ${share}% of your spending (${formatMoney(summary.busiest.amount, currency)}).${deltaText}`);
  }
  const topDay = [...weekdaySeries].sort((a, b) => b.amount - a.amount)[0];
  if (topDay && topDay.amount > 0) {
    lines.push(`${topDay.label} is your highest-spend day of the week at ${formatMoney(topDay.amount, currency)} total.`);
  }
  const dangerBudget = budgetInfo.rows.find((r) => r.isOver || r.isWarn);
  if (dangerBudget) {
    lines.push(`${dangerBudget.label} has reached ${dangerBudget.pct}% of its monthly limit (${dangerBudget.statusText}).`);
  } else if (summary.totalIncome > 0) {
    lines.push(`You are currently saving ${summary.savingsRate}% of your monthly income (${formatMoney(summary.netBalance, currency)} net).`);
  }
  return lines.slice(0, 4);
}