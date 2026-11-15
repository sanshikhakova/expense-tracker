import { CONFIG, formatMoney, formatCompact, escapeHTML } from './format.js';

/** Computes clean human-friendly Y-axis tick intervals for bar and line charts. */
function niceTicks(maxVal, count = 4) {
  if (maxVal <= 0) return [0, 100000];
  const rough = maxVal / count;
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow10).find((s) => s >= rough) || rough;
  const ticks = [];
  for (let v = 0; v <= maxVal + step * 0.99; v += step) ticks.push(Math.round(v));
  return ticks;
}

/** Converts polar angle (degrees clockwise from top) to Cartesian SVG coordinates. */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Builds an SVG donut ring arc path between startAngle and endAngle. */
function describeArc(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const sweep = Math.min(359.99, endAngle - startAngle);
  const end = startAngle + sweep;
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, end);
  const p3 = polarToCartesian(cx, cy, rInner, end);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  const large = sweep > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

/** Renders an interactive SVG donut chart of spending by category. */
export function renderDonutChart(breakdown, activeTotal, currency) {
  const size = CONFIG.chartSizes.donut.size;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 104;
  const rInner = 68;
  const visible = breakdown.filter((c) => !c.hidden && c.amount > 0);

  if (!visible.length || activeTotal <= 0) {
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="No category spending data">
      <title>Spending by Category Donut Chart</title><desc>No expense data available for active categories.</desc>
      <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}" fill="none" stroke="var(--border)" stroke-width="28" />
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-muted)" font-size="12">No expenses</text>
    </svg>`;
  }

  let angle = 0;
  const paths = visible.map((cat) => {
    const sliceDeg = (cat.amount / activeTotal) * 360;
    const d = describeArc(cx, cy, rOuter, rInner, angle, angle + sliceDeg);
    angle += sliceDeg;
    const tip = `${escapeHTML(cat.label)}: ${formatMoney(cat.amount, currency)} (${cat.pct}%)`;
    return `<path class="svg-slice" d="${d}" fill="${cat.color}" tabindex="0" data-tip="${tip}" aria-label="${tip}" />`;
  }).join('');

  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Donut chart of spending by category">
    <title>Spending by Category</title>
    <desc>Total active expenses: ${formatMoney(activeTotal, currency)}</desc>
    ${paths}
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="10">TOTAL SPENT</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="700" class="mono">${formatCompact(activeTotal, currency)}</text>
  </svg>`;
}

/** Renders a 6-month grouped bar chart comparing income vs expenses. */
export function renderMonthlyBarChart(series, currency) {
  const { width: w, height: h } = CONFIG.chartSizes.bar;
  const pad = { top: 18, right: 16, bottom: 28, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...series.flatMap((s) => [s.income, s.expense]), 100);
  const ticks = niceTicks(maxVal, 4);
  const yMax = ticks[ticks.length - 1];

  const grid = ticks.map((t) => {
    const y = pad.top + plotH - (t / yMax) * plotH;
    return `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 3" />
      <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10" class="mono">${formatCompact(t, currency)}</text>`;
  }).join('');

  const groupW = plotW / series.length;
  const barW = Math.min(20, groupW * 0.32);
  const bars = series.map((s, idx) => {
    const gx = pad.left + idx * groupW + groupW / 2;
    const hInc = (s.income / yMax) * plotH;
    const hExp = (s.expense / yMax) * plotH;
    const tipInc = `${s.month} Income: ${formatMoney(s.income, currency)}`;
    const tipExp = `${s.month} Expense: ${formatMoney(s.expense, currency)}`;
    return `<rect class="svg-bar" x="${gx - barW - 2}" y="${pad.top + plotH - hInc}" width="${barW}" height="${Math.max(1, hInc)}" rx="4" fill="var(--income)" data-tip="${tipInc}" tabindex="0" />
      <rect class="svg-bar" x="${gx + 2}" y="${pad.top + plotH - hExp}" width="${barW}" height="${Math.max(1, hExp)}" rx="4" fill="var(--expense)" data-tip="${tipExp}" tabindex="0" />
      <text x="${gx}" y="${h - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="10" class="mono">${s.month.slice(2)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="6-month income versus expense bar chart">
    <title>6-Month Income vs Expense</title><desc>Grouped bar comparison across the past six months.</desc>
    ${grid}${bars}
  </svg>`;
}

/** Renders the daily spending area/line chart with average dashed line and peak marker. */
export function renderDailyLineChart(dailyData, currency) {
  const { width: w, height: h } = CONFIG.chartSizes.line;
  const pad = { top: 18, right: 16, bottom: 26, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const { days, avg, peak } = dailyData;
  const maxVal = Math.max(peak.amount, avg, 100);
  const ticks = niceTicks(maxVal, 3);
  const yMax = ticks[ticks.length - 1];

  const pts = days.map((d, idx) => {
    const x = pad.left + (idx / Math.max(1, days.length - 1)) * plotW;
    const y = pad.top + plotH - (d.amount / yMax) * plotH;
    return { ...d, x, y };
  });

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${pad.top + plotH} L ${pts[0].x.toFixed(1)} ${pad.top + plotH} Z`;
  const avgY = pad.top + plotH - (avg / yMax) * plotH;
  const peakPt = pts[peak.day - 1] || pts[0];

  const yLabels = ticks.map((t) => {
    const y = pad.top + plotH - (t / yMax) * plotH;
    return `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10" class="mono">${formatCompact(t, currency)}</text>`;
  }).join('');

  const dots = pts.filter((p) => p.amount > 0).map((p) => {
    const tip = `Day ${p.day}: ${formatMoney(p.amount, currency)}`;
    return `<circle class="svg-bar" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--accent)" data-tip="${tip}" tabindex="0" />`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily spending trajectory line chart">
    <title>Daily Spending Trajectory</title><desc>Daily expenses with average reference line and peak day highlight.</desc>
    ${yLabels}
    <path d="${areaD}" fill="var(--accent)" opacity="0.14" />
    <path class="svg-line-anim" d="${lineD}" fill="none" stroke="var(--accent)" stroke-width="2.4" />
    <line x1="${pad.left}" y1="${avgY.toFixed(1)}" x2="${w - pad.right}" y2="${avgY.toFixed(1)}" stroke="var(--amber)" stroke-dasharray="5 4" stroke-width="1.5" />
    ${peak.amount > 0 ? `<circle cx="${peakPt.x.toFixed(1)}" cy="${peakPt.y.toFixed(1)}" r="6" fill="var(--expense)" data-tip="Peak Day ${peak.day}: ${formatMoney(peak.amount, currency)}" />` : ''}
    ${dots}
  </svg>`;
}

/** Renders the 7-day weekday spending bar chart highlighting the peak spending day. */
export function renderWeekdayChart(weekdaySeries, currency) {
  const { width: w, height: h } = CONFIG.chartSizes.weekday;
  const pad = { top: 18, right: 12, bottom: 26, left: 12 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...weekdaySeries.map((d) => d.amount), 100);
  const colW = plotW / weekdaySeries.length;

  const bars = weekdaySeries.map((d, idx) => {
    const bh = (d.amount / maxVal) * plotH;
    const x = pad.left + idx * colW + colW * 0.2;
    const isPeak = d.amount === maxVal && d.amount > 0;
    const tip = `${d.label}: ${formatMoney(d.amount, currency)}`;
    return `<rect class="svg-bar" x="${x.toFixed(1)}" y="${(pad.top + plotH - bh).toFixed(1)}" width="${(colW * 0.6).toFixed(1)}" height="${Math.max(2, bh).toFixed(1)}" rx="5" fill="${isPeak ? 'var(--expense)' : 'var(--accent)'}" data-tip="${tip}" tabindex="0" />
      <text x="${(pad.left + idx * colW + colW / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${d.label}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Weekday spending bar chart">
    <title>Spending by Weekday</title><desc>Total expenditure grouped Monday through Sunday.</desc>
    ${bars}
  </svg>`;
}

/** Renders a compact overall monthly budget progress ring SVG. */
export function renderBudgetRing(used, total) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const rawPct = total > 0 ? Math.round((used / total) * 100) : 0;
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const stroke = rawPct > 100 ? 'var(--expense)' : rawPct >= 80 ? 'var(--amber)' : 'var(--income)';
  return `<svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--border)" stroke-width="6" />
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="${stroke}" stroke-width="6" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 31 31)" stroke-linecap="round" />
    <text x="31" y="34" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)" class="mono">${rawPct}%</text>
  </svg>`;
}