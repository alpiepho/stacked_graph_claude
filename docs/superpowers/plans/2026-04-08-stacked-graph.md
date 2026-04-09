# Stacked Graph PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite PWA that lets users paste CSV financial data, configure column mappings, and view an interactive stacked bar chart binned by month — with hover tooltips, series filters, and income/expenses/net summary stats — deployed to GitHub Pages.

**Architecture:** Single-page vanilla JS app with no routing. Pure logic modules (`csv.js`, `aggregate.js`, `filters.js`, `summary.js`, `storage.js`) are tested with Vitest; DOM modules (`chart.js`, `main.js`) wire everything together. `vite-plugin-pwa` generates the service worker and manifest at build time.

**Tech Stack:** Vite 5, vanilla JS (ES modules), Chart.js 4, vite-plugin-pwa, Vitest 1 (jsdom environment)

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies and scripts |
| `vite.config.js` | Vite + PWA plugin + Vitest config |
| `index.html` | App shell — all DOM structure |
| `src/style.css` | Layout, component styles |
| `src/csv.js` | `parseCSV`, `detectDateColumn`, `generateSampleData` |
| `src/aggregate.js` | `aggregate(rows, dateCol, stackCol)` → `{months, series}` |
| `src/summary.js` | `calcSummary(rows, dateCol)` → income/expenses/net |
| `src/filters.js` | `applyFilters`, `getCCAccounts`, `isCCRow`, `isCUCCPayment` |
| `src/storage.js` | `save(key, val)`, `load(key, default)`, `loadAll()` |
| `src/chart.js` | Chart.js render, hover opacity, custom legend |
| `src/main.js` | DOM refs, event listeners, init, render orchestration |
| `public/icons/icon-192.png` | PWA icon 192×192 |
| `public/icons/icon-512.png` | PWA icon 512×512 |
| `.github/workflows/deploy.yml` | Build and deploy to gh-pages |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "stacked-graph",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chart.js": "^4.4.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.19.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

> **Note:** Update `base` to match your GitHub repo name (e.g. `/stacked_graph/`). This is required for GitHub Pages asset paths.

```js
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/stacked_graph/',
  test: {
    environment: 'jsdom'
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stacked Graph',
        short_name: 'StackedGraph',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#16213e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js .gitignore
git commit -m "chore: scaffold Vite project"
```

---

## Task 2: index.html App Shell

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stacked Graph</title>
</head>
<body>
  <div id="app">

    <!-- CSV Input -->
    <div class="section">
      <div class="section-header">
        <button id="csv-toggle" class="toggle-btn">▼ CSV Data</button>
        <button id="sample-btn" class="secondary-btn">Generate Sample Data</button>
      </div>
      <div id="csv-panel">
        <textarea
          id="csv-input"
          placeholder="Paste CSV data here (headers required)..."
          spellcheck="false"
        ></textarea>
        <div id="csv-error" class="error-msg hidden"></div>
      </div>
    </div>

    <!-- Column Pickers -->
    <div class="section hidden" id="column-section">
      <label>Date column <select id="date-col"></select></label>
      <label>Stack by <select id="stack-col"></select></label>
    </div>

    <!-- Filters -->
    <div class="section hidden" id="filter-section">
      <label><input type="checkbox" id="filter-show-all-cc" checked> Show all CC accounts individually</label>
      <label><input type="checkbox" id="filter-replace-cu"> Replace CU credit card payment with CC details</label>
      <div id="filter-pick-cc" class="hidden"></div>
    </div>

    <!-- Chart -->
    <div class="section hidden" id="chart-section">
      <div class="chart-scroll">
        <canvas id="chart-canvas"></canvas>
      </div>
      <div id="legend"></div>
    </div>

    <!-- Summary -->
    <div class="section hidden" id="summary-section">
      <div class="summary-cards">
        <div id="summary-income" class="summary-card income"></div>
        <div id="summary-expenses" class="summary-card expenses"></div>
        <div id="summary-net" class="summary-card net"></div>
      </div>
    </div>

  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts, browser shows blank page with no console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add app shell HTML"
```

---

## Task 3: CSS Styles

**Files:**
- Create: `src/style.css`

- [ ] **Step 1: Create `src/style.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #1a1a2e;
  --surface: #16213e;
  --surface2: #0f3460;
  --accent: #4ecca3;
  --danger: #e94560;
  --text: #e0e0e0;
  --muted: #888;
  --radius: 6px;
  --gap: 12px;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
  font-size: 14px;
  padding: var(--gap);
}

#app { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--gap); }

.section { background: var(--surface); border-radius: var(--radius); padding: var(--gap); }
.section-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.hidden { display: none !important; }

/* CSV Panel */
.toggle-btn {
  background: none; border: 1px solid var(--accent); color: var(--accent);
  border-radius: var(--radius); padding: 4px 10px; cursor: pointer; font-size: 13px;
}
.toggle-btn:hover { background: var(--accent); color: var(--bg); }

.secondary-btn {
  background: none; border: 1px solid var(--muted); color: var(--muted);
  border-radius: var(--radius); padding: 4px 10px; cursor: pointer; font-size: 13px;
}
.secondary-btn:hover { border-color: var(--text); color: var(--text); }

#csv-panel { display: flex; flex-direction: column; gap: 6px; }
#csv-panel.collapsed { display: none; }

#csv-input {
  width: 100%; height: 120px; background: var(--bg); color: var(--text);
  border: 1px solid var(--surface2); border-radius: var(--radius);
  padding: 8px; font-family: monospace; font-size: 12px; resize: vertical;
}
#csv-input:focus { outline: 1px solid var(--accent); }

.error-msg { color: var(--danger); font-size: 12px; }

/* Column Pickers */
#column-section { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
#column-section label { display: flex; gap: 6px; align-items: center; }
select {
  background: var(--surface2); color: var(--text); border: 1px solid var(--muted);
  border-radius: var(--radius); padding: 4px 8px;
}

/* Filters */
#filter-section { display: flex; flex-direction: column; gap: 8px; }
#filter-section label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
#filter-pick-cc { display: flex; flex-wrap: wrap; gap: 8px; padding-left: 20px; }
#filter-pick-cc label { font-size: 12px; }

/* Chart */
.chart-scroll { overflow-x: auto; width: 100%; }
#chart-canvas { height: 400px; display: block; }

/* Legend */
#legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.legend-row {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  padding: 3px 8px; border-radius: var(--radius); background: var(--surface2);
}
.legend-swatch { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; }

/* Summary */
.summary-cards { display: flex; gap: var(--gap); flex-wrap: wrap; }
.summary-card {
  flex: 1; min-width: 180px; background: var(--surface2);
  border-radius: var(--radius); padding: var(--gap);
}
.summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 6px; }
.summary-monthly { font-size: 22px; font-weight: 600; }
.summary-annual { font-size: 12px; color: var(--muted); margin-top: 2px; }
.summary-card.income .summary-monthly { color: var(--accent); }
.summary-card.expenses .summary-monthly { color: var(--danger); }
.summary-card.net .summary-monthly { color: var(--text); }
```

- [ ] **Step 2: Import CSS in `src/main.js`** (create stub for now)

Create `src/main.js`:
```js
import './style.css'
```

- [ ] **Step 3: Verify styles load**

```bash
npm run dev
```

Expected: Dark background visible in browser, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/style.css src/main.js
git commit -m "feat: add styles and CSS layout"
```

---

## Task 4: CSV Parser (TDD)

**Files:**
- Create: `src/csv.js`
- Create: `tests/csv.test.js`

- [ ] **Step 1: Create test file `tests/csv.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { parseCSV, detectDateColumn } from '../src/csv.js'

describe('parseCSV', () => {
  it('returns headers and rows from valid CSV', () => {
    const text = 'name,amount,date\nalice,100,2024-01-01\nbob,-50,2024-01-15'
    const { headers, rows } = parseCSV(text)
    expect(headers).toEqual(['name', 'amount', 'date'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ name: 'alice', amount: '100', date: '2024-01-01' })
    expect(rows[1]).toEqual({ name: 'bob', amount: '-50', date: '2024-01-15' })
  })

  it('trims whitespace from headers and values', () => {
    const text = ' name , amount \n alice , 100 '
    const { headers, rows } = parseCSV(text)
    expect(headers).toEqual(['name', 'amount'])
    expect(rows[0]).toEqual({ name: 'alice', amount: '100' })
  })

  it('skips blank lines', () => {
    const text = 'a,b\n1,2\n\n3,4\n'
    const { rows } = parseCSV(text)
    expect(rows).toHaveLength(2)
  })

  it('throws on text with fewer than 2 lines', () => {
    expect(() => parseCSV('just a header')).toThrow()
    expect(() => parseCSV('')).toThrow()
  })
})

describe('detectDateColumn', () => {
  it('prefers transaction_date when present', () => {
    expect(detectDateColumn(['statement_date', 'transaction_date', 'amount'])).toBe('transaction_date')
  })

  it('falls back to first column containing "date"', () => {
    expect(detectDateColumn(['amount', 'effective_date', 'description'])).toBe('effective_date')
  })

  it('falls back to first column when no date column found', () => {
    expect(detectDateColumn(['account', 'amount', 'category'])).toBe('account')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/csv.js'`

- [ ] **Step 3: Create `src/csv.js` with implementation**

```js
/**
 * Parse a CSV string into headers and rows.
 * Handles trimming. Does NOT handle quoted fields containing commas.
 * @param {string} text
 * @returns {{ headers: string[], rows: Object[] }}
 */
export function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })

  return { headers, rows }
}

/**
 * Pick the best date column from a list of headers.
 * @param {string[]} headers
 * @returns {string}
 */
export function detectDateColumn(headers) {
  if (headers.includes('transaction_date')) return 'transaction_date'
  const dateLike = headers.find(h => h.toLowerCase().includes('date'))
  return dateLike ?? headers[0]
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: All `csv.test.js` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/csv.js tests/csv.test.js
git commit -m "feat: CSV parser with detectDateColumn"
```

---

## Task 5: Sample Data Generator (TDD)

**Files:**
- Modify: `src/csv.js` (add `generateSampleData`)
- Modify: `tests/csv.test.js` (add tests)

- [ ] **Step 1: Add tests for `generateSampleData` in `tests/csv.test.js`**

Append to the file:

```js
import { generateSampleData } from '../src/csv.js'

describe('generateSampleData', () => {
  it('returns a parseable CSV string', () => {
    const text = generateSampleData()
    expect(() => parseCSV(text)).not.toThrow()
  })

  it('has the expected headers', () => {
    const { headers } = parseCSV(generateSampleData())
    expect(headers).toContain('statement_type')
    expect(headers).toContain('transaction_date')
    expect(headers).toContain('amount')
    expect(headers).toContain('account')
  })

  it('covers at least 6 distinct months', () => {
    const { rows } = parseCSV(generateSampleData())
    const months = new Set(rows.map(r => r.transaction_date?.slice(0, 7)))
    expect(months.size).toBeGreaterThanOrEqual(6)
  })

  it('includes both positive and negative amounts', () => {
    const { rows } = parseCSV(generateSampleData())
    const amounts = rows.map(r => parseFloat(r.amount))
    expect(amounts.some(a => a > 0)).toBe(true)
    expect(amounts.some(a => a < 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
npm test
```

Expected: FAIL — `generateSampleData is not a function`

- [ ] **Step 3: Add `generateSampleData` to `src/csv.js`**

Append to `src/csv.js`:

```js
/**
 * Generate realistic sample financial CSV data covering 12 months.
 * Includes checking account (CU) and two credit cards.
 * @returns {string} CSV text
 */
export function generateSampleData() {
  const header = 'statement_type,statement_date,account,entry_type,transaction_date,effective_date,category,description,amount'
  const rows = []
  const year = 2024

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const d = (day) => `${year}-${mm}-${String(day).padStart(2, '0')}`

    // Income: paycheck deposited to checking
    rows.push(`checking,${d(1)},Salary,credit,${d(1)},${d(1)},Income,Monthly Salary,3500.00`)

    // Rent from checking
    rows.push(`checking,${d(1)},Rent,debit,${d(1)},${d(1)},Housing,Apartment Rent,-1200.00`)

    // Checking pays Visa (CU credit card payment)
    rows.push(`checking,${d(15)},Visa Payment,debit,${d(15)},${d(15)},CC Payment,credit card payment,-650.00`)

    // Checking pays Mastercard (CU credit card payment)
    rows.push(`checking,${d(16)},MC Payment,debit,${d(16)},${d(16)},CC Payment,credit card payment,-350.00`)

    // Visa transactions
    rows.push(`credit_card,${d(5)},visa_card,debit,${d(5)},${d(5)},Groceries,Whole Foods,-200.00`)
    rows.push(`credit_card,${d(12)},visa_card,debit,${d(12)},${d(12)},Dining,Restaurant,-150.00`)
    rows.push(`credit_card,${d(20)},visa_card,debit,${d(20)},${d(20)},Entertainment,Netflix,-50.00`)
    rows.push(`credit_card,${d(22)},visa_card,debit,${d(22)},${d(22)},Shopping,Amazon,-250.00`)

    // Mastercard transactions
    rows.push(`credit_card,${d(8)},mastercard,debit,${d(8)},${d(8)},Utilities,Electric Bill,-120.00`)
    rows.push(`credit_card,${d(18)},mastercard,debit,${d(18)},${d(18)},Groceries,Trader Joes,-130.00`)
    rows.push(`credit_card,${d(25)},mastercard,debit,${d(25)},${d(25)},Gas,Shell Gas,-100.00`)
  }

  return [header, ...rows].join('\n')
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/csv.js tests/csv.test.js
git commit -m "feat: sample data generator"
```

---

## Task 6: Data Aggregation (TDD)

**Files:**
- Create: `src/aggregate.js`
- Create: `tests/aggregate.test.js`

- [ ] **Step 1: Create `tests/aggregate.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { aggregate } from '../src/aggregate.js'

const rows = [
  { date: '2024-01-05', account: 'visa',   amount: '-100' },
  { date: '2024-01-20', account: 'checking', amount: '3500' },
  { date: '2024-02-05', account: 'visa',   amount: '-200' },
  { date: '2024-02-10', account: 'checking', amount: '3500' },
  { date: '2024-02-15', account: 'visa',   amount: '-50' },
]

describe('aggregate', () => {
  it('returns sorted unique months', () => {
    const { months } = aggregate(rows, 'date', 'account')
    expect(months).toEqual(['2024-01', '2024-02'])
  })

  it('returns one series per unique stack value', () => {
    const { series } = aggregate(rows, 'date', 'account')
    expect(series.map(s => s.label).sort()).toEqual(['checking', 'visa'])
  })

  it('sums amounts per series per month', () => {
    const { months, series } = aggregate(rows, 'date', 'account')
    const visa = series.find(s => s.label === 'visa')
    const checking = series.find(s => s.label === 'checking')
    expect(visa.data).toEqual([-100, -250]) // Jan: -100, Feb: -200 + -50
    expect(checking.data).toEqual([3500, 3500])
  })

  it('fills zero for months where a series has no data', () => {
    const sparse = [
      { date: '2024-01-01', account: 'a', amount: '100' },
      { date: '2024-02-01', account: 'b', amount: '200' },
    ]
    const { series } = aggregate(sparse, 'date', 'account')
    const a = series.find(s => s.label === 'a')
    const b = series.find(s => s.label === 'b')
    expect(a.data).toEqual([100, 0])
    expect(b.data).toEqual([0, 200])
  })

  it('skips rows with missing date or stack column', () => {
    const dirty = [
      { date: '', account: 'visa', amount: '-50' },
      { date: '2024-01-01', account: '', amount: '-50' },
      { date: '2024-01-01', account: 'visa', amount: '-100' },
    ]
    const { series } = aggregate(dirty, 'date', 'account')
    const visa = series.find(s => s.label === 'visa')
    expect(visa.data).toEqual([-100])
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/aggregate.js'`

- [ ] **Step 3: Create `src/aggregate.js`**

```js
/**
 * Group rows by month and sum amounts per stack-by value.
 * @param {Object[]} rows - parsed CSV rows
 * @param {string} dateCol - column name containing YYYY-MM-DD dates
 * @param {string} stackCol - column name to group series by
 * @returns {{ months: string[], series: Array<{label: string, data: number[]}> }}
 */
export function aggregate(rows, dateCol, stackCol) {
  const monthSet = new Set()
  // label -> (month -> sum)
  const seriesMap = new Map()

  for (const row of rows) {
    const month = row[dateCol]?.slice(0, 7)
    const label = row[stackCol]
    const amount = parseFloat(row.amount) || 0

    if (!month || !label) continue

    monthSet.add(month)
    if (!seriesMap.has(label)) seriesMap.set(label, {})
    const monthData = seriesMap.get(label)
    monthData[month] = (monthData[month] ?? 0) + amount
  }

  const months = [...monthSet].sort()

  const series = [...seriesMap.entries()].map(([label, monthData]) => ({
    label,
    data: months.map(m => monthData[m] ?? 0)
  }))

  return { months, series }
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.js tests/aggregate.test.js
git commit -m "feat: monthly aggregation"
```

---

## Task 7: Summary Calculations (TDD)

**Files:**
- Create: `src/summary.js`
- Create: `tests/summary.test.js`

- [ ] **Step 1: Create `tests/summary.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { calcSummary } from '../src/summary.js'

const rows = [
  { transaction_date: '2024-01-01', amount: '3500' },
  { transaction_date: '2024-01-05', amount: '-1200' },
  { transaction_date: '2024-01-10', amount: '-300' },
  { transaction_date: '2024-02-01', amount: '3500' },
  { transaction_date: '2024-02-08', amount: '-1200' },
  { transaction_date: '2024-02-15', amount: '-500' },
]

describe('calcSummary', () => {
  it('sums positive amounts as income', () => {
    const { income } = calcSummary(rows, 'transaction_date')
    expect(income.total).toBeCloseTo(7000)
  })

  it('sums negative amounts as expenses (positive value)', () => {
    const { expenses } = calcSummary(rows, 'transaction_date')
    expect(expenses.total).toBeCloseTo(3200)
  })

  it('net = income total - expenses total', () => {
    const { net } = calcSummary(rows, 'transaction_date')
    expect(net.total).toBeCloseTo(3800)
  })

  it('monthly = total / number of unique months', () => {
    const { income, expenses, net } = calcSummary(rows, 'transaction_date')
    expect(income.monthly).toBeCloseTo(3500)   // 7000 / 2
    expect(expenses.monthly).toBeCloseTo(1600) // 3200 / 2
    expect(net.monthly).toBeCloseTo(1900)      // 3800 / 2
  })

  it('handles single month', () => {
    const single = [
      { transaction_date: '2024-01-01', amount: '1000' },
      { transaction_date: '2024-01-15', amount: '-400' },
    ]
    const { income, expenses, net } = calcSummary(single, 'transaction_date')
    expect(income.total).toBeCloseTo(1000)
    expect(expenses.total).toBeCloseTo(400)
    expect(net.monthly).toBeCloseTo(600)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/summary.js'`

- [ ] **Step 3: Create `src/summary.js`**

```js
/**
 * Calculate income, expenses, and net totals + monthly averages.
 * Income = sum of positive amounts. Expenses = absolute sum of negative amounts.
 * @param {Object[]} rows
 * @param {string} dateCol - used to count distinct months for monthly average
 * @returns {{
 *   income:   { total: number, monthly: number },
 *   expenses: { total: number, monthly: number },
 *   net:      { total: number, monthly: number }
 * }}
 */
export function calcSummary(rows, dateCol) {
  let totalIncome = 0
  let totalExpenses = 0
  const months = new Set()

  for (const row of rows) {
    const amount = parseFloat(row.amount) || 0
    const month = row[dateCol]?.slice(0, 7)
    if (month) months.add(month)
    if (amount > 0) totalIncome += amount
    else totalExpenses += Math.abs(amount)
  }

  const monthCount = months.size || 1
  const totalNet = totalIncome - totalExpenses

  return {
    income:   { total: totalIncome,   monthly: totalIncome   / monthCount },
    expenses: { total: totalExpenses, monthly: totalExpenses / monthCount },
    net:      { total: totalNet,      monthly: totalNet      / monthCount }
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/summary.js tests/summary.test.js
git commit -m "feat: income/expenses/net summary calculations"
```

---

## Task 8: Filter Logic (TDD)

**Files:**
- Create: `src/filters.js`
- Create: `tests/filters.test.js`

- [ ] **Step 1: Create `tests/filters.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { isCCRow, isCUCCPayment, getCCAccounts, applyFilters } from '../src/filters.js'

const sampleRows = [
  { statement_type: 'checking', account: 'Salary',     description: 'Monthly Salary',       amount: '3500' },
  { statement_type: 'checking', account: 'CU Pay',     description: 'credit card payment',  amount: '-650' },
  { statement_type: 'credit_card', account: 'visa_card',   description: 'Whole Foods',      amount: '-200' },
  { statement_type: 'credit_card', account: 'visa_card',   description: 'Netflix',          amount: '-50'  },
  { statement_type: 'credit_card', account: 'mastercard',  description: 'Electric Bill',    amount: '-120' },
]

describe('isCCRow', () => {
  it('returns true for credit_card statement_type', () => {
    expect(isCCRow(sampleRows[2])).toBe(true)
  })
  it('returns false for checking', () => {
    expect(isCCRow(sampleRows[0])).toBe(false)
  })
})

describe('isCUCCPayment', () => {
  it('returns true when checking row description contains "credit card"', () => {
    expect(isCUCCPayment(sampleRows[1])).toBe(true)
  })
  it('returns false for income row', () => {
    expect(isCUCCPayment(sampleRows[0])).toBe(false)
  })
  it('returns false for a CC row (not a CU row)', () => {
    expect(isCUCCPayment(sampleRows[2])).toBe(false)
  })
})

describe('getCCAccounts', () => {
  it('returns unique CC account names', () => {
    const accounts = getCCAccounts(sampleRows)
    expect(accounts.sort()).toEqual(['mastercard', 'visa_card'])
  })
})

describe('applyFilters', () => {
  it('showAllCC=true keeps all CC rows as-is', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: [] })
    const ccRows = result.filter(r => r.statement_type === 'credit_card')
    expect(ccRows.map(r => r.account).includes('visa_card')).toBe(true)
    expect(ccRows.map(r => r.account).includes('mastercard')).toBe(true)
  })

  it('showAllCC=false merges all CC rows under "Credit Cards" account', () => {
    const result = applyFilters(sampleRows, { showAllCC: false, replaceCUPay: false, pickedCC: [] })
    const ccRows = result.filter(r => r.statement_type === 'credit_card')
    expect(ccRows.every(r => r.account === 'Credit Cards')).toBe(true)
  })

  it('replaceCUPay=true removes CU credit card payment rows', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: true, pickedCC: [] })
    const cuPayRow = result.find(r => r.description === 'credit card payment')
    expect(cuPayRow).toBeUndefined()
  })

  it('replaceCUPay=false keeps CU credit card payment rows', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: [] })
    const cuPayRow = result.find(r => r.description === 'credit card payment')
    expect(cuPayRow).toBeDefined()
  })

  it('pickedCC filters to only selected CC accounts (non-CC rows always included)', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: ['visa_card'] })
    const mcRow = result.find(r => r.account === 'mastercard')
    const visaRow = result.find(r => r.account === 'visa_card')
    const incomeRow = result.find(r => r.account === 'Salary')
    expect(mcRow).toBeUndefined()
    expect(visaRow).toBeDefined()
    expect(incomeRow).toBeDefined() // non-CC rows always pass through
  })

  it('pickedCC=[] includes all CC accounts', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: [] })
    expect(result.find(r => r.account === 'mastercard')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/filters.js'`

- [ ] **Step 3: Create `src/filters.js`**

```js
// Configurable constants — update these to match your actual statement_type values
const CC_STATEMENT_TYPES = ['credit_card']
const CU_STATEMENT_TYPES = ['checking', 'savings']
// Substrings in description that identify a CU row as a CC payment
const CU_CC_PAYMENT_KEYWORDS = ['credit card', 'card payment', 'cc payment']

/** @param {Object} row */
export function isCCRow(row) {
  return CC_STATEMENT_TYPES.includes(row.statement_type?.toLowerCase())
}

/** @param {Object} row */
export function isCUCCPayment(row) {
  if (!CU_STATEMENT_TYPES.includes(row.statement_type?.toLowerCase())) return false
  const desc = (row.description ?? '').toLowerCase()
  return CU_CC_PAYMENT_KEYWORDS.some(kw => desc.includes(kw))
}

/**
 * Get all unique CC account names from rows.
 * @param {Object[]} rows
 * @returns {string[]}
 */
export function getCCAccounts(rows) {
  return [...new Set(rows.filter(isCCRow).map(r => r.account).filter(Boolean))]
}

/**
 * Apply user-selected filters to the full row set.
 * @param {Object[]} rows
 * @param {{ showAllCC: boolean, replaceCUPay: boolean, pickedCC: string[] }} filters
 * @returns {Object[]}
 */
export function applyFilters(rows, { showAllCC, replaceCUPay, pickedCC }) {
  let filtered = rows

  // Remove CU rows that are CC payments
  if (replaceCUPay) {
    filtered = filtered.filter(r => !isCUCCPayment(r))
  }

  // Combine all CC accounts into one series
  if (!showAllCC) {
    filtered = filtered.map(r =>
      isCCRow(r) ? { ...r, account: 'Credit Cards' } : r
    )
  }

  // Keep only picked CC accounts (empty pickedCC = include all)
  if (pickedCC.length > 0) {
    filtered = filtered.filter(r => !isCCRow(r) || pickedCC.includes(r.account))
  }

  return filtered
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/filters.js tests/filters.test.js
git commit -m "feat: CC/CU filter logic"
```

---

## Task 9: localStorage Helpers (TDD)

**Files:**
- Create: `src/storage.js`
- Create: `tests/storage.test.js`

- [ ] **Step 1: Create `tests/storage.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { save, load, loadAll } from '../src/storage.js'

beforeEach(() => {
  localStorage.clear()
})

describe('save / load', () => {
  it('round-trips a string', () => {
    save('csv', 'hello,world\n1,2')
    expect(load('csv', '')).toBe('hello,world\n1,2')
  })

  it('round-trips an object', () => {
    const filters = { showAllCC: true, replaceCUPay: false, pickedCC: ['visa'] }
    save('filters', filters)
    expect(load('filters', null)).toEqual(filters)
  })

  it('round-trips an array', () => {
    save('hidden_series', ['visa', 'mastercard'])
    expect(load('hidden_series', [])).toEqual(['visa', 'mastercard'])
  })

  it('returns default when key is absent', () => {
    expect(load('missing_key', 'default')).toBe('default')
  })

  it('uses sg_ prefix so keys do not collide with unrelated storage', () => {
    save('csv', 'test')
    expect(localStorage.getItem('sg_csv')).not.toBeNull()
    expect(localStorage.getItem('csv')).toBeNull()
  })
})

describe('loadAll', () => {
  it('returns defaults when localStorage is empty', () => {
    const all = loadAll()
    expect(all.csv).toBe('')
    expect(all.dateCol).toBeNull()
    expect(all.stackCol).toBeNull()
    expect(all.filters.showAllCC).toBe(true)
    expect(all.filters.replaceCUPay).toBe(false)
    expect(all.filters.pickedCC).toEqual([])
    expect(all.hiddenSeries).toEqual([])
    expect(all.csvCollapsed).toBe(true)
  })

  it('returns saved values when present', () => {
    save('csv', 'a,b\n1,2')
    save('date_col', 'b')
    const all = loadAll()
    expect(all.csv).toBe('a,b\n1,2')
    expect(all.dateCol).toBe('b')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/storage.js'`

- [ ] **Step 3: Create `src/storage.js`**

```js
const PREFIX = 'sg_'

/**
 * Save a value to localStorage under the sg_ namespace.
 * @param {string} key - without prefix
 * @param {*} value - will be JSON-serialized
 */
export function save(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

/**
 * Load a value from localStorage.
 * @param {string} key - without prefix
 * @param {*} defaultValue - returned if key is absent or parse fails
 * @returns {*}
 */
export function load(key, defaultValue = null) {
  const raw = localStorage.getItem(PREFIX + key)
  if (raw === null) return defaultValue
  try {
    return JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

/**
 * Load all persisted app settings with their defaults.
 * @returns {{
 *   csv: string,
 *   dateCol: string|null,
 *   stackCol: string|null,
 *   filters: { showAllCC: boolean, replaceCUPay: boolean, pickedCC: string[] },
 *   hiddenSeries: string[],
 *   csvCollapsed: boolean
 * }}
 */
export function loadAll() {
  return {
    csv:          load('csv', ''),
    dateCol:      load('date_col', null),
    stackCol:     load('stack_col', null),
    filters:      load('filters', { showAllCC: true, replaceCUPay: false, pickedCC: [] }),
    hiddenSeries: load('hidden_series', []),
    csvCollapsed: load('csv_collapsed', true)
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat: localStorage persistence helpers"
```

---

## Task 10: Chart Module

**Files:**
- Create: `src/chart.js`

> No unit tests for this module — it requires a real DOM canvas. Verified manually in Task 11.

- [ ] **Step 1: Create `src/chart.js`**

```js
import Chart from 'chart.js/auto'

const COLORS = [
  '#4ecca3', '#e94560', '#54a0ff', '#ffd32a', '#ff9f43',
  '#ee5a24', '#0652DD', '#9980FA', '#833471', '#1289A7'
]

/** @type {Chart|null} */
let chartInstance = null

/**
 * Render or re-render the stacked bar chart.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} legendContainer
 * @param {{ months: string[], series: Array<{label: string, data: number[]}> }} chartData
 * @param {string[]} hiddenSeries - labels of series that should start hidden
 * @param {function(string, boolean): void} onLegendToggle - called with (label, isVisible)
 */
export function renderChart(canvas, legendContainer, { months, series }, hiddenSeries, onLegendToggle) {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  // Size canvas for horizontal scrollability
  const minWidth = Math.max(800, months.length * 64)
  canvas.style.width = minWidth + 'px'
  canvas.style.height = '400px'
  canvas.width = minWidth
  canvas.height = 400

  const datasets = series.map((s, i) => ({
    label: s.label,
    data: s.data,
    backgroundColor: COLORS[i % COLORS.length],
    stack: 'main',
    hidden: hiddenSeries.includes(s.label)
  }))

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels: months, datasets },
    options: {
      responsive: false,
      animation: false,
      scales: {
        x: { stacked: true, ticks: { color: '#888' }, grid: { color: '#16213e' } },
        y: { stacked: true, ticks: { color: '#888', callback: v => '$' + v }, grid: { color: '#16213e' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: item => ` ${item.dataset.label}: $${item.parsed.y.toFixed(2)}`,
            footer: items => {
              const total = items.reduce((sum, i) => sum + i.parsed.y, 0)
              return `Total: $${total.toFixed(2)}`
            }
          }
        }
      },
      onHover: (_event, activeElements) => {
        if (!chartInstance) return
        if (activeElements.length === 0) {
          // Restore all series to full opacity
          chartInstance.data.datasets.forEach((ds, i) => {
            ds.backgroundColor = COLORS[i % COLORS.length]
          })
        } else {
          const hoveredIdx = activeElements[0].datasetIndex
          chartInstance.data.datasets.forEach((ds, i) => {
            ds.backgroundColor = i === hoveredIdx
              ? COLORS[i % COLORS.length]
              : COLORS[i % COLORS.length] + '33' // ~20% opacity
          })
        }
        chartInstance.update('none')
      }
    }
  })

  _renderLegend(legendContainer, datasets, onLegendToggle)
}

/**
 * @param {HTMLElement} container
 * @param {Object[]} datasets
 * @param {function(string, boolean): void} onToggle
 */
function _renderLegend(container, datasets, onToggle) {
  container.innerHTML = ''

  datasets.forEach((ds, i) => {
    const row = document.createElement('div')
    row.className = 'legend-row'

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = !ds.hidden
    cb.addEventListener('change', () => {
      if (chartInstance) {
        chartInstance.setDatasetVisibility(i, cb.checked)
        chartInstance.update()
      }
      onToggle(ds.label, cb.checked)
    })

    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.background = COLORS[i % COLORS.length]

    const label = document.createElement('span')
    label.textContent = ds.label

    row.append(cb, swatch, label)
    container.appendChild(row)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/chart.js
git commit -m "feat: Chart.js stacked bar with hover and custom legend"
```

---

## Task 11: Main.js — Wire Everything Together

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Replace `src/main.js` with full implementation**

```js
import './style.css'
import { parseCSV, detectDateColumn, generateSampleData } from './csv.js'
import { aggregate } from './aggregate.js'
import { applyFilters, getCCAccounts } from './filters.js'
import { calcSummary } from './summary.js'
import { save, load, loadAll } from './storage.js'
import { renderChart } from './chart.js'

// ── DOM refs ────────────────────────────────────────────────────────────────
const csvToggle    = document.getElementById('csv-toggle')
const csvPanel     = document.getElementById('csv-panel')
const csvInput     = document.getElementById('csv-input')
const csvError     = document.getElementById('csv-error')
const sampleBtn    = document.getElementById('sample-btn')
const dateColSel   = document.getElementById('date-col')
const stackColSel  = document.getElementById('stack-col')
const columnSection  = document.getElementById('column-section')
const filterSection  = document.getElementById('filter-section')
const chartSection   = document.getElementById('chart-section')
const summarySection = document.getElementById('summary-section')
const showAllCCCb  = document.getElementById('filter-show-all-cc')
const replaceCUCb  = document.getElementById('filter-replace-cu')
const pickCCDiv    = document.getElementById('filter-pick-cc')
const chartCanvas  = document.getElementById('chart-canvas')
const legendDiv    = document.getElementById('legend')
const summaryIncome   = document.getElementById('summary-income')
const summaryExpenses = document.getElementById('summary-expenses')
const summaryNet      = document.getElementById('summary-net')

// ── App state ────────────────────────────────────────────────────────────────
let rows = []
let headers = []
const settings = loadAll()

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Restore CSV panel state
  csvInput.value = settings.csv
  if (settings.csvCollapsed) {
    csvPanel.classList.add('collapsed')
    csvToggle.textContent = '▶ CSV Data'
  }

  // Restore filter checkboxes
  showAllCCCb.checked = settings.filters.showAllCC
  replaceCUCb.checked = settings.filters.replaceCUPay

  // If we have saved CSV, parse it and render
  if (settings.csv) {
    try {
      const parsed = parseCSV(settings.csv)
      rows = parsed.rows
      headers = parsed.headers
      _showColumns()
      _populateSelects(headers, settings.dateCol, settings.stackCol)
      _updatePickCC()
      _render()
    } catch (_e) {
      // Saved CSV is invalid — clear it silently
      save('csv', '')
    }
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────
function _render() {
  const dateCol  = dateColSel.value
  const stackCol = stackColSel.value

  const pickedCC = [...pickCCDiv.querySelectorAll('input[type=checkbox]:checked')]
    .map(el => el.value)

  const filters = {
    showAllCC:    showAllCCCb.checked,
    replaceCUPay: replaceCUCb.checked,
    pickedCC
  }

  const filtered    = applyFilters(rows, filters)
  const chartData   = aggregate(filtered, dateCol, stackCol)
  const summary     = calcSummary(filtered, dateCol)

  renderChart(
    chartCanvas,
    legendDiv,
    chartData,
    settings.hiddenSeries,
    (label, visible) => {
      if (visible) {
        settings.hiddenSeries = settings.hiddenSeries.filter(s => s !== label)
      } else {
        if (!settings.hiddenSeries.includes(label)) settings.hiddenSeries.push(label)
      }
      save('hidden_series', settings.hiddenSeries)
    }
  )

  _renderSummary(summary)
}

function _renderSummary({ income, expenses, net }) {
  const fmt = (n) => '$' + n.toFixed(2)
  summaryIncome.innerHTML = `
    <div class="summary-label">Income</div>
    <div class="summary-monthly">${fmt(income.monthly)}<span style="font-size:13px;font-weight:400">/mo</span></div>
    <div class="summary-annual">${fmt(income.total)} / yr</div>`
  summaryExpenses.innerHTML = `
    <div class="summary-label">Expenses</div>
    <div class="summary-monthly">${fmt(expenses.monthly)}<span style="font-size:13px;font-weight:400">/mo</span></div>
    <div class="summary-annual">${fmt(expenses.total)} / yr</div>`
  summaryNet.innerHTML = `
    <div class="summary-label">Net</div>
    <div class="summary-monthly">${fmt(net.monthly)}<span style="font-size:13px;font-weight:400">/mo</span></div>
    <div class="summary-annual">${fmt(net.total)} / yr</div>`
}

function _showColumns() {
  columnSection.classList.remove('hidden')
  filterSection.classList.remove('hidden')
  chartSection.classList.remove('hidden')
  summarySection.classList.remove('hidden')
}

function _populateSelects(hdrs, savedDate, savedStack) {
  const dateDefault  = savedDate  ?? detectDateColumn(hdrs)
  const stackDefault = savedStack ?? hdrs[0]

  dateColSel.innerHTML = hdrs.map(h =>
    `<option value="${h}"${h === dateDefault  ? ' selected' : ''}>${h}</option>`
  ).join('')

  stackColSel.innerHTML = hdrs.map(h =>
    `<option value="${h}"${h === stackDefault ? ' selected' : ''}>${h}</option>`
  ).join('')
}

function _updatePickCC() {
  const accounts = getCCAccounts(rows)
  if (accounts.length === 0) {
    pickCCDiv.classList.add('hidden')
    return
  }
  pickCCDiv.classList.remove('hidden')
  pickCCDiv.innerHTML = '<span style="color:var(--muted);font-size:12px">Pick CC accounts: </span>' +
    accounts.map(acc => {
      const checked = settings.filters.pickedCC.length === 0 || settings.filters.pickedCC.includes(acc)
      return `<label><input type="checkbox" value="${acc}"${checked ? ' checked' : ''}> ${acc}</label>`
    }).join('')

  // Attach change listeners to the newly created checkboxes
  pickCCDiv.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', _onFilterChange)
  })
}

// ── Event handlers ───────────────────────────────────────────────────────────
csvToggle.addEventListener('click', () => {
  const collapsed = csvPanel.classList.toggle('collapsed')
  csvToggle.textContent = collapsed ? '▶ CSV Data' : '▼ CSV Data'
  save('csv_collapsed', collapsed)
})

sampleBtn.addEventListener('click', () => {
  csvInput.value = generateSampleData()
  csvInput.dispatchEvent(new Event('input'))
})

let _parseTimer = null
csvInput.addEventListener('input', () => {
  clearTimeout(_parseTimer)
  _parseTimer = setTimeout(() => {
    const text = csvInput.value.trim()
    csvError.textContent = ''
    csvError.classList.add('hidden')

    if (!text) return

    try {
      const parsed = parseCSV(text)
      rows    = parsed.rows
      headers = parsed.headers
      save('csv', text)
      _showColumns()
      _populateSelects(headers, null, null)
      _updatePickCC()
      _render()
    } catch (e) {
      csvError.textContent = e.message
      csvError.classList.remove('hidden')
    }
  }, 300)
})

dateColSel.addEventListener('change', () => {
  save('date_col', dateColSel.value)
  _render()
})

stackColSel.addEventListener('change', () => {
  save('stack_col', stackColSel.value)
  _render()
})

function _onFilterChange() {
  const pickedCC = [...pickCCDiv.querySelectorAll('input[type=checkbox]:checked')]
    .map(el => el.value)
  settings.filters = {
    showAllCC:    showAllCCCb.checked,
    replaceCUPay: replaceCUCb.checked,
    pickedCC
  }
  save('filters', settings.filters)
  _render()
}

showAllCCCb.addEventListener('change', _onFilterChange)
replaceCUCb.addEventListener('change', _onFilterChange)

// ── Boot ─────────────────────────────────────────────────────────────────────
init()
```

- [ ] **Step 2: Run dev server and smoke test manually**

```bash
npm run dev
```

Open the browser URL. Verify:
1. Page loads with dark background, "CSV Data" toggle visible
2. Click "Generate Sample Data" → textarea fills with CSV
3. Column dropdowns appear, chart renders as stacked bars, legend shows colored rows
4. Summary shows Income / Expenses / Net with monthly and annual figures
5. Hover a bar → other series dim to low opacity
6. Toggle legend checkboxes → series hide/show in chart
7. Collapse and reopen CSV panel — state preserved
8. Reload page → all settings restored from localStorage

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire all modules, localStorage restore, full app functional"
```

---

## Task 12: PWA Icons

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`

> Icons must be real PNG files; vite-plugin-pwa validates them at build time.

- [ ] **Step 1: Create icon directory**

```bash
mkdir -p public/icons
```

- [ ] **Step 2: Generate icons using Node canvas script**

Create a temporary script `scripts/gen-icons.mjs`:

```js
// scripts/gen-icons.mjs
// Run with: node scripts/gen-icons.mjs
// Requires: npm install -D canvas (install temporarily, uninstall after)
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'

function makeIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#16213e'
  ctx.fillRect(0, 0, size, size)

  // Simple bar chart graphic
  const bars = [0.4, 0.7, 0.5, 0.9, 0.6]
  const pad = size * 0.15
  const barW = (size - pad * 2) / bars.length
  const colors = ['#4ecca3', '#e94560', '#54a0ff', '#ffd32a', '#4ecca3']

  bars.forEach((h, i) => {
    ctx.fillStyle = colors[i]
    const barH = (size - pad * 2) * h
    ctx.fillRect(pad + i * barW + 2, size - pad - barH, barW - 4, barH)
  })

  return canvas.toBuffer('image/png')
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', makeIcon(192))
writeFileSync('public/icons/icon-512.png', makeIcon(512))
console.log('Icons generated.')
```

Run:
```bash
npm install -D canvas
node scripts/gen-icons.mjs
npm uninstall canvas
rm scripts/gen-icons.mjs
```

Expected: `public/icons/icon-192.png` and `public/icons/icon-512.png` created.

> **Alternative:** Place any 192×192 and 512×512 PNG files in `public/icons/` manually (e.g., exported from Figma, Canva, or any image editor).

- [ ] **Step 3: Verify build succeeds with PWA**

```bash
npm run build
```

Expected: `dist/` created, no errors. `dist/manifest.webmanifest` should be present.

- [ ] **Step 4: Commit**

```bash
git add public/icons/
git commit -m "feat: add PWA icons"
```

---

## Task 13: GitHub Actions Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Enable GitHub Pages on your repo**

On GitHub.com: Settings → Pages → Source: `Deploy from a branch` → Branch: `gh-pages` → Save.

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 3: Run all tests one final time**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions deploy to gh-pages"
git push origin main
```

Expected: GitHub Actions workflow triggers. Check the Actions tab on your repo — build should succeed and deploy to Pages.

- [ ] **Step 5: Verify live URL**

Open `https://<your-username>.github.io/stacked_graph/`

Verify: App loads, "Generate Sample Data" works, chart renders, PWA install prompt available in browser.

---

## All Tests

```bash
npm test
```

Expected passing tests:
- `csv.test.js` — parseCSV, detectDateColumn, generateSampleData
- `aggregate.test.js` — aggregate
- `summary.test.js` — calcSummary
- `filters.test.js` — isCCRow, isCUCCPayment, getCCAccounts, applyFilters
- `storage.test.js` — save/load/loadAll
