# Stacked Graph PWA — Design Spec

**Date:** 2026-04-08
**Status:** Approved

## Overview

A progressive web app that visualizes personal financial CSV data as an interactive stacked bar chart, binned by month. Deployed to GitHub Pages. No backend — all data is pasted in by the user.

---

## Architecture

**Stack:** Vite + vanilla JS + Chart.js. `vite-plugin-pwa` handles the service worker and manifest.

**File structure:**

```
stacked_graph/
├── index.html
├── src/
│   ├── main.js         # entry point, wires up all modules
│   ├── csv.js          # CSV parsing, column detection
│   ├── chart.js        # Chart.js stacked bar, hover logic
│   ├── filters.js      # checkbox filter logic
│   ├── summary.js      # income / expenses / net calculations
│   └── style.css
├── public/
│   ├── manifest.json
│   └── icons/
├── vite.config.js
├── .github/workflows/
│   └── deploy.yml
└── package.json
```

**Deployment:** GitHub Actions — on push to `main`, runs `npm ci && npm run build`, deploys `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`. GitHub Pages serves the `gh-pages` branch.

---

## Layout

Single-column, top-to-bottom:

1. Collapsible CSV textarea
2. Column picker dropdowns
3. Filter checkboxes
4. Stacked bar chart (horizontally scrollable)
5. Summary stats panel

---

## CSV Input

- A `<textarea>` at the top, collapsed by default, expandable via a toggle button.
- A **"Generate Sample Data"** button next to the toggle fills the textarea with realistic synthetic CSV data (12 months, multiple accounts/categories, mix of income and expenses). This lets users explore the app immediately without their own data.
- User pastes raw CSV text, edits it directly in the textarea, or uses the generated sample. The textarea is always editable.
- On input change (debounced ~300ms), `csv.js` parses the text using vanilla JS (no library dependency — comma-separated, first row is headers).
- Expected columns in `all.csv`: `statement_type`, `statement_date`, `account`, `entry_type`, `transaction_date`, `effective_date`, `category`, `description`, `amount`.
- If parsing fails (bad CSV), show an inline error message below the textarea.

---

## Column Mapping

After a successful parse, two `<select>` dropdowns render:

- **Date column** — defaults to `transaction_date` if present, otherwise the first column. Used to bin data by month.
- **Stack by** — user picks any column (e.g., `account`, `category`). Each unique value in this column becomes one stacked series.

---

## Filtering

Three checkboxes rendered above the chart:

1. **Show all CC** — toggles individual credit card accounts vs. combined into one "Credit Cards" series.
2. **Replace CU pay with CC details** — when a credit union row represents a credit card payment, substitute it with the matching CC transaction rows (matched by amount and date proximity).
3. **Pick CC to stack** — reveals a multi-select list of CC account names; only checked accounts are included in the stack.

The set of available CC accounts is derived at parse time from unique values in the `account` column where `statement_type` indicates a credit card (exact match values TBD by user — configurable as a constant in `filters.js`).

---

## Data Aggregation

1. Parse `amount` as a float. Positive = income, negative = expense.
2. Parse the chosen date column. Date format is `YYYY-MM-DD`. Extract `YYYY-MM` to bin by month.
3. For each month, sum `amount` per unique value in the chosen stack-by column.
4. Pass the result to Chart.js as one dataset per stack-by value.

---

## Chart

**Type:** Stacked bar (Chart.js), one bar per month.
- X-axis: months (`YYYY-MM`), chronological.
- Y-axis: dollar amounts. Positive values extend upward; negative values extend downward. Both income and expense bars are rendered on the same axis.
- The chart canvas is rendered at full data width; the container div is `overflow-x: scroll` for horizontal scrolling when months exceed viewport.

**Hover behavior:**
- Chart.js tooltip plugin shows a floating box: one line per series (color swatch + series name + amount), plus a total line.
- `onHover` callback updates each dataset's `backgroundColor` opacity — hovered series stays at 100%, all others drop to 20%.
- On mouse leave, all series restore to 100% opacity.

**Color key / legend:**
- Custom legend rendered below the chart (replaces Chart.js built-in).
- One row per series: colored swatch + label + checkbox to toggle that series on/off.
- Toggling a series checkbox hides/shows its dataset in the chart without re-aggregating.

---

## Summary Panel

Rendered below the chart. Three cards: **Income**, **Expenses**, **Net**.

Each card shows:
- **Monthly average** — total ÷ number of months in the dataset
- **Annual total** — sum of all months

Calculated from the currently filtered/visible data (respects checkbox filters).

Income = sum of all positive `amount` rows. Expenses = sum of all negative `amount` rows (displayed as a positive number). Net = income + expenses (sum of all amounts).

---

## Persistence (localStorage)

All user settings are saved to `localStorage` as they change and restored on startup before any rendering. If localStorage values are present, they take precedence over defaults.

Persisted keys (all under a `sg_` namespace, e.g. `sg_csv`):

| Key | What it stores |
|---|---|
| `sg_csv` | Raw CSV text currently in the textarea |
| `sg_date_col` | Selected date column name |
| `sg_stack_col` | Selected stack-by column name |
| `sg_filters` | Checkbox states (show all CC, replace CU pay, picked CC accounts) |
| `sg_hidden_series` | Array of series labels toggled off in the color key |
| `sg_csv_collapsed` | Whether the CSV textarea panel is collapsed |

On startup, `main.js` reads all `sg_*` keys, populates the textarea and controls, then triggers a parse + render.

---

## PWA

- `public/manifest.json`: name, short_name, icons (at minimum 192×192 and 512×512 PNG), `display: standalone`, theme and background colors.
- `vite-plugin-pwa` auto-generates a Workbox service worker that precaches all built assets.
- App is fully functional offline after first load (no network requests after install — all data is pasted in).

---

## GitHub Actions Deployment

`.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## Out of Scope

- No user accounts or data persistence beyond the pasted session.
- No server-side processing.
- No mobile-specific gestures (pinch-zoom, swipe) beyond browser defaults.
- No CSV export.
