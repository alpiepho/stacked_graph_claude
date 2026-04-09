# Stacked Graph

A progressive web app for visualizing personal financial CSV data as an interactive stacked bar chart, binned by month.

## Features

- **Paste CSV data** directly into the app — no file upload, no server
- **Interactive stacked bar chart** with hover tooltips and per-series opacity dimming
- **Flexible column mapping** — pick which column is the date axis and which drives the stacked series
- **CC/CU filters** — combine or split credit card accounts, replace credit union CC payments with the underlying card transactions
- **Income / Expenses / Net** summary panel with monthly averages and annual totals
- **Persistent settings** — all column choices, filters, and hidden series are saved to localStorage and restored on reload
- **Works offline** — installable PWA, all assets precached after first load
- **Generates sample data** — try the app immediately without your own CSV

## CSV Format

The app expects a CSV with these headers:

```
statement_type,statement_date,account,entry_type,transaction_date,effective_date,category,description,amount
```

- **`amount`** — positive values are income, negative values are expenses
- **`transaction_date`** — format `YYYY-MM-DD`, used for monthly binning by default
- Other columns can be used as the stack-by axis (e.g. `account`, `category`)

The CC/CU filter logic looks for `statement_type = credit_card` to identify credit card rows and scans `description` for keywords like `"credit card payment"` to identify CU payment rows. Update the constants in `src/filters.js` if your data uses different values.

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

The entire process — from blank directory to working PWA with 40 passing tests and a GitHub Actions deploy pipeline — was completed in a single Claude Code session.

## Tech Stack

- [Vite](https://vitejs.dev/) — build tool
- [Chart.js](https://www.chartjs.org/) — stacked bar chart
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — service worker + PWA manifest
- [Vitest](https://vitest.dev/) — unit tests (jsdom environment)
