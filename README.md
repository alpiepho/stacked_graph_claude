# Stacked Graph

Try here: https://alpiepho.github.io/stacked_graph_claude/

A progressive web app for visualizing personal financial CSV data as an interactive stacked bar chart, binned by month.

## Features

- **Paste CSV data** directly into the app — no file upload, no server
- **Interactive stacked bar chart** with hover tooltips and per-series opacity dimming
- **Flexible column mapping** — pick which column is the date axis and which drives the stacked series
- **CC/CU filters** — replace credit union CC payment rows with the underlying card transactions; optionally filter out CC credit (payment received) entries that would skew calculations
- **Stable bar colors** — each series keeps its color regardless of filter state
- **Month range slider** — double-ended slider to zoom into a date window; summary and lines update to match
- **Income / Expenses / Net overlay lines** — toggle each line independently from the legend
- **Income / Expenses / Net summary panel** with monthly averages and annual totals
- **Keyboard shortcuts** — inspect transactions while hovering a bar (see below)
- **Persistent settings** — column choices, filters, hidden series, and collapsed state are saved to localStorage and restored on reload
- **Works offline** — installable PWA, all assets precached after first load
- **Generates sample data** — try the app immediately without your own CSV

## CSV Format

The app expects a CSV with these headers:

```
statement_type,statement_date,account,entry_type,transaction_date,effective_date,category,description,amount
```

- **`amount`** — positive values are income/credits, negative values are expenses/debits
- **`transaction_date`** — format `YYYY-MM-DD`, used for monthly binning by default
- **`entry_type`** — `transaction` for regular rows; `payment-<card>` (e.g. `payment-visa_card`) for credit union CC payment rows; `balance` rows are ignored
- **`statement_type`** — identifies the account type; CC statement types are derived automatically from `payment-*` entry_type suffixes
- Other columns can be used as the stack-by axis (e.g. `account`, `category`)

### CC/CU Payment Detection

CC accounts are identified by scanning `entry_type` values for the `payment-<suffix>` pattern — the suffix is the CC account's `statement_type`. This approach works for any account name, including URLs like `www.chase.com/amazon`.

A `payment-visa_card` entry_type means:
- The row is a credit union outgoing payment to the visa card
- `visa_card` is the statement_type of the credit card account

## Filters

| Filter | Description |
|--------|-------------|
| **Replace CU credit card payment with CC details** | Hides the CU-side lump-sum CC payment rows and shows individual card transactions instead |
| **Filter CC credits** | Removes positive (credit/payment received) transactions from CC accounts — useful when CC detail is enabled and payment-received credits would inflate income totals |

## Keyboard Shortcuts

These shortcuts work when hovering over a bar in the chart. Results appear in the collapsible debug panel.

| Key | Action |
|-----|--------|
| `t` | Show all transactions for the **hovered series and month** |
| `a` | Show all transactions for the **hovered month**, broken out by account with a net summary |
| `c` | Show all transactions for the **hovered month**, broken out by category with a net summary |

The `a` and `c` dumps each end with a condensed **Summary** table listing the net value per account or category and a grand total.

## Development

```bash
npm install
npm run dev       # start dev server at http://localhost:5173/stacked_graph/
npm test          # run all tests
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## Deployment

The app deploys automatically to GitHub Pages on every push to `main` via GitHub Actions.

**One-time setup:**
1. In your GitHub repo: Settings → Pages → Source: `gh-pages` branch
2. If your repo name differs from `stacked_graph`, update `base` in `vite.config.js`:
   ```js
   base: '/your-repo-name/',
   ```

After that, push to `main` and your app will be live at `https://<username>.github.io/stacked_graph/`.

## How This Was Built

This project was designed and implemented entirely through [Claude Code](https://claude.ai/code) using the [Superpowers](https://github.com/anthropics/claude-code) plugin and its structured development workflow:

1. **Brainstorming** — The app was sketched in Excalidraw and described to Claude. Through a collaborative Q&A (one question at a time), the design was refined: layout, chart library, CSV input approach, column mapping, filter logic, localStorage persistence, and PWA setup.

2. **Design spec** — Claude produced a written spec (`docs/superpowers/specs/2026-04-08-stacked-graph-design.md`) covering architecture, data flow, chart behavior, filtering logic, and deployment. The spec was reviewed and approved before any code was written.

3. **Implementation plan** — A detailed task-by-task plan (`docs/superpowers/plans/2026-04-08-stacked-graph.md`) was generated with complete code for every step, TDD test cases, exact commands, and expected output.

4. **Subagent-driven development** — Each of the 13 tasks was handed to a fresh Claude subagent with only the context it needed. After each task, two separate reviewer subagents checked spec compliance and code quality before the next task began.

The entire process — from blank directory to working PWA with 40 passing tests and a GitHub Actions deploy pipeline — was completed in a single Claude Code session. Ongoing feature development continues through conversational iteration with Claude Code.

## Tech Stack

- [Vite](https://vitejs.dev/) — build tool
- [Chart.js](https://www.chartjs.org/) — stacked bar chart
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — service worker + PWA manifest
- [Vitest](https://vitest.dev/) — unit tests (jsdom environment)
