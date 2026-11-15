# Budget Lens — Expense Tracker & Visual Budget Analytics

**Live Demo:**  https://sanshikhakova.github.io/expense-tracker/

Budget Lens is a zero-dependency personal finance and data visualization web application built with vanilla HTML5, CSS3, and modular ES6+ JavaScript. Designed as a lightweight client-side data pipeline, it collects transaction records in integer minor units, aggregates monthly metrics, forecasts month-end spending via linear projection, and renders four interactive charts drawn completely by hand using JavaScript-generated SVG.

---

## Features

- **Precision Transaction Management:** Add, edit, and delete expenses or income with inline validation, keyboard shortcuts (`N` to add, `/` to search, `Esc` to close), and a 5-second Undo toast.
- **Hand-Built SVG Visualizations:** Interactive Category Donut Chart (polar-to-Cartesian arcs with clickable legend toggles), 6-Month Grouped Income vs. Expense Bar Chart, Daily Spending Trajectory Area/Line Chart, and Weekday Spending Bar Chart.
- **Category & Overall Monthly Budgets:** Set monthly spending caps per category with visual progress bars that shift from emerald to amber at 80% and coral above 100%, paired with an overall monthly budget ring.
- **Statistical Telemetry & Insights:** Computes 8 live KPI cards, month-over-month percentage change, linear month-end spend projection, and auto-generated plain-English insights.
- **CSV Round-Trip & Seeded Demo Generator:** Export transactions to RFC-4180 compliant CSV, import external CSVs with row-level validation previews, or load 4 months of reproducible sample data via a deterministic Mulberry32 PRNG.

---

## Tech Stack

- **Markup:** Semantic HTML5 (`<dialog>`/ARIA roles, accessible hidden data tables)
- **Styling:** Modern CSS3 (12-column responsive grid, custom properties, `tabular-nums`, `@media print` summary stylesheet)
- **Logic & Graphics:** Vanilla ES6+ JavaScript Modules, Hand-Crafted SVG (`<path>`, `<rect>`, `<circle>`), `Intl.NumberFormat`, `localStorage`

---

## How It Works (Data Flow)

```text
store.js (Versioned State + localStorage)
       │
       ▼
analytics.js (Pure Aggregations, Medians, MoM %, Linear Projections)
       │
       ├──► charts.js (Pure Data-to-SVG String Builders + Nice-Tick Scaling)
       └──► ui.js     (DOM Rendering, Delegated Events, Accessible Tables)