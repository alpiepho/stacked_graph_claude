import './style.css'
import { parseCSV, detectDateColumn, detectStackColumn, generateSampleData } from './csv.js'
import { aggregate } from './aggregate.js'
import { applyFilters, getCCAccounts, getCCStatementTypes } from './filters.js'
import { calcSummary } from './summary.js'
import { save, loadAll } from './storage.js'
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
const replaceCUCb  = document.getElementById('filter-replace-cu')
const chartCanvas  = document.getElementById('chart-canvas')
const legendDiv    = document.getElementById('legend')
const summaryIncome   = document.getElementById('summary-income')
const summaryExpenses = document.getElementById('summary-expenses')
const summaryNet      = document.getElementById('summary-net')
const debugSection    = document.getElementById('debug-section')
const debugOutput     = document.getElementById('debug-output')
const debugClose      = document.getElementById('debug-close')
const debugCopy       = document.getElementById('debug-copy')

// ── App state ────────────────────────────────────────────────────────────────
let rows = []
let headers = []
const settings = loadAll()

// Hover + dump state
let _hoveredMonth  = null
let _hoveredLabel  = null
let _lastFiltered  = []
let _lastDateCol   = null
let _lastStackCol  = null
let _lastChartData = { months: [], series: [] }
let _dumpActive    = false  // true while a transaction dump is displayed; suppresses _showDebug overwrites
let _lastWorkingRows = []   // filtered rows after sign inversion (matches what the chart shows)

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Restore CSV panel state
  csvInput.value = settings.csv
  if (settings.csvCollapsed) {
    csvPanel.classList.add('collapsed')
    csvToggle.textContent = '▶ CSV Data'
  }

  // Restore filter checkboxes
  replaceCUCb.checked = settings.filters.replaceCUPay

  // If we have saved CSV, parse it and render
  if (settings.csv) {
    try {
      const parsed = parseCSV(settings.csv)
      rows = parsed.rows
      headers = parsed.headers
      _showColumns()
      _populateSelects(headers, settings.dateCol, settings.stackCol)
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

  const replaceCUPay = replaceCUCb.checked
  const filtered = applyFilters(rows, { replaceCUPay })
  // When not replacing CU CC payments, CC rows are hidden; collect them for grayed legend
  const disabledSeries = replaceCUPay ? [] : getCCAccounts(rows)

  // Apply per-series sign inversion (for CC accounts where debits are positive)
  const inverted = settings.invertedAccounts ?? []
  const workingRows = inverted.length === 0 ? filtered : filtered.map(row => {
    if (!inverted.includes(row[stackCol])) return row
    const amt = parseFloat(row.amount) || 0
    return { ...row, amount: String(-amt) }
  })

  const chartData   = aggregate(workingRows, dateCol, stackCol)
  _lastFiltered    = filtered
  _lastWorkingRows = workingRows
  _lastDateCol     = dateCol
  _lastStackCol    = stackCol
  _lastChartData   = chartData
  _showDebug(rows, filtered, dateCol, stackCol, chartData, { replaceCUPay })

  // Rows for lines/summary: exclude series hidden via legend checkboxes
  const hiddenSet  = new Set(settings.hiddenSeries ?? [])
  const visibleRows = workingRows.filter(row => !hiddenSet.has(row[stackCol]))

  const summary     = calcSummary(visibleRows, dateCol)

  // Build per-month income/expenses/net arrays aligned to the chart's month labels
  const byMonth = {}
  visibleRows.forEach(row => {
    const month = row[dateCol]?.slice(0, 7)
    if (!month) return
    if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 }
    const amount = parseFloat(row.amount) || 0
    if (amount > 0) byMonth[month].income += amount
    else byMonth[month].expenses += Math.abs(amount)
  })
  const lineData = {
    income:   chartData.months.map(m => byMonth[m]?.income   ?? 0),
    expenses: chartData.months.map(m => byMonth[m]?.expenses ?? 0),
    net:      chartData.months.map(m => (byMonth[m]?.income ?? 0) - (byMonth[m]?.expenses ?? 0)),
  }

  renderChart(
    chartCanvas,
    legendDiv,
    chartData,
    settings.hiddenSeries,
    (label, visible) => {
      settings.hiddenSeries = settings.hiddenSeries ?? []
      if (visible) {
        settings.hiddenSeries = settings.hiddenSeries.filter(s => s !== label)
      } else {
        if (!settings.hiddenSeries.includes(label)) settings.hiddenSeries.push(label)
      }
      save('hidden_series', settings.hiddenSeries)
    },
    lineData,
    settings.linesVisible,
    (key, visible) => {
      settings.linesVisible = { ...settings.linesVisible, [key]: visible }
      save('lines_visible', settings.linesVisible)
    },
    (month, label) => {
      _hoveredMonth = month
      _hoveredLabel = label
    },
    settings.invertedAccounts ?? [],
    (label) => {
      const inv = settings.invertedAccounts ?? []
      settings.invertedAccounts = inv.includes(label)
        ? inv.filter(l => l !== label)
        : [...inv, label]
      save('inverted_accounts', settings.invertedAccounts)
      _render()
    },
    disabledSeries
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
  const stackDefault = savedStack ?? detectStackColumn(hdrs)

  dateColSel.innerHTML = hdrs.map(h =>
    `<option value="${h}"${h === dateDefault  ? ' selected' : ''}>${h}</option>`
  ).join('')

  stackColSel.innerHTML = hdrs.map(h =>
    `<option value="${h}"${h === stackDefault ? ' selected' : ''}>${h}</option>`
  ).join('')
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
  settings.filters = { replaceCUPay: replaceCUCb.checked }
  save('filters', settings.filters)
  _render()
}

replaceCUCb.addEventListener('change', _onFilterChange)

// ── Debug ────────────────────────────────────────────────────────────────────
function _showDebug(allRows, filteredRows, dateCol, stackCol, chartData, filters) {
  if (_dumpActive) return  // don't overwrite an active transaction dump
  const counts = (arr, key) => {
    const map = {}
    arr.forEach(r => { const v = r[key] ?? '(blank)'; map[v] = (map[v] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([v, n]) => `  "${v}" × ${n}`).join('\n')
  }

  const amountSamples = allRows.slice(0, 5).map(r => {
    const raw = r.amount
    const parsed = parseFloat(raw)
    return `  "${raw}" → ${isNaN(parsed) ? 'NaN ⚠' : parsed}`
  }).join('\n')

  const dateSamples = allRows.slice(0, 3).map(r =>
    `  "${r[dateCol]}" → month "${r[dateCol]?.slice(0, 7) ?? '?'}"`
  ).join('\n')

  // Unique accounts in filtered rows (what actually reaches aggregate)
  const filteredAccountMap = {}
  filteredRows.forEach(r => {
    const v = r.account ?? '(blank)'
    filteredAccountMap[v] = (filteredAccountMap[v] || 0) + 1
  })
  const filteredAccounts = Object.entries(filteredAccountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `  "${v}" × ${n}`)
    .join('\n')

  // CC detection: statement_types identified as CC via 'transaction-*' entry_types
  const ccDetected = [...getCCStatementTypes(allRows)]

  debugOutput.textContent = [
    `Total rows parsed:          ${allRows.length}`,
    `Rows after entry_type filter: ${filteredRows.length}  ← should be > 0`,
    ``,
    `── Active settings ──`,
    `  Stack by column: "${stackCol}"`,
    `  Replace CU CC payments with CC details: ${filters.replaceCUPay}`,
    ``,
    `── Chart series (${chartData.series.length} total → one checkbox each) ──`,
    chartData.series.length === 0
      ? '  (none — check stack column and filter settings)'
      : chartData.series.map(s => `  "${s.label}"`).join('\n'),
    ``,
    `── Accounts in filtered rows (${Object.keys(filteredAccountMap).length} unique) ──`,
    filteredAccounts || '  (none)',
    ``,
    `── CC detection (statement_types from transaction-* entry_types) ──`,
    ccDetected.length === 0
      ? '  (none — no transaction-* entry_types found)'
      : ccDetected.map(t => `  "${t}"`).join('\n'),
    ``,
    `── Raw data ──`,
    `entry_type values (all rows):`,
    counts(allRows, 'entry_type'),
    ``,
    `amount samples (first 5):`,
    amountSamples,
    ``,
    `${dateCol} samples (first 3):`,
    dateSamples,
  ].join('\n')

  debugSection.classList.remove('hidden')
}

debugClose.addEventListener('click', () => {
  debugSection.classList.add('hidden')
  _dumpActive = false
})

debugCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(debugOutput.textContent).then(() => {
    const prev = debugCopy.textContent
    debugCopy.textContent = 'Copied!'
    setTimeout(() => { debugCopy.textContent = prev }, 1500)
  })
})

// ── 't'/'a' key: dump transactions for hovered bar/line ──────────────────────
const LINE_LABELS = ['Income line', 'Expenses line', 'Net line']

document.addEventListener('keydown', e => {
  // Don't intercept keys typed into form elements
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

  const key = e.key.toLowerCase()

  const hidden = new Set(settings.hiddenSeries ?? [])
  const isVisible = row => !hidden.has(row[_lastStackCol])

  if (key === 't') {
    if (!_hoveredMonth || !_hoveredLabel) return
    const isLine = LINE_LABELS.includes(_hoveredLabel)
    const matchingRows = _lastWorkingRows.filter(row => {
      const month = row[_lastDateCol]?.slice(0, 7)
      if (month !== _hoveredMonth) return false
      if (isLine) return isVisible(row)           // line: all visible series for this month
      return row[_lastStackCol] === _hoveredLabel // bar: just the hovered series
    })
    _showTransactionDump([{ title: `"${_hoveredLabel}" — ${_hoveredMonth}`, rows: matchingRows }])
  }

  if (key === 'a') {
    if (!_hoveredMonth || _lastWorkingRows.length === 0) return

    // All transactions for the hovered month (enabled series only), then one section per visible series
    const monthRows = _lastWorkingRows.filter(row =>
      row[_lastDateCol]?.slice(0, 7) === _hoveredMonth && isVisible(row)
    )
    const sections = [{ title: `All transactions — ${_hoveredMonth}`, rows: monthRows }]

    for (const s of _lastChartData.series) {
      if (hidden.has(s.label)) continue
      const txRows = monthRows.filter(row => row[_lastStackCol] === s.label)
      if (txRows.length > 0) {
        sections.push({ title: `"${s.label}" — ${_hoveredMonth}`, rows: txRows })
      }
    }

    _showTransactionDump(sections)
  }
})

function _showTransactionDump(sections) {
  _dumpActive = true
  const SEP  = '  ' + '─'.repeat(72)
  const colW = { date: 12, account: 22, category: 14, description: 26, amount: 10 }
  const pad  = (s, w) => String(s ?? '').slice(0, w).padEnd(w)
  const rpad = (s, w) => String(s ?? '').slice(0, w).padStart(w)

  const hdr = '  ' + [
    pad('date',        colW.date),
    pad('account',     colW.account),
    pad('category',    colW.category),
    pad('description', colW.description),
    rpad('amount',     colW.amount),
  ].join('  ')

  const renderSection = ({ title, rows: txRows }) => {
    const dataLines = txRows.map(r => {
      const amt    = parseFloat(r.amount) || 0
      const amtStr = (amt >= 0 ? '+' : '') + amt.toFixed(2)
      return '  ' + [
        pad(r[_lastDateCol], colW.date),
        pad(r.account,       colW.account),
        pad(r.category,      colW.category),
        pad(r.description,   colW.description),
        rpad(amtStr,         colW.amount),
      ].join('  ')
    })
    let deposits = 0, debits = 0
    txRows.forEach(r => {
      const amt = parseFloat(r.amount) || 0
      if (amt >= 0) deposits += amt; else debits += Math.abs(amt)
    })
    const total    = deposits - debits
    const totalStr = (total >= 0 ? '+' : '') + total.toFixed(2)
    const subtotal = `  Deposits: +${deposits.toFixed(2)}    Debits: -${debits.toFixed(2)}`
    return [
      `── ${title} (${txRows.length} rows) ──`,
      SEP, hdr, SEP,
      ...dataLines,
      SEP,
      subtotal,
      `  ${txRows.length} rows    Net: ${totalStr}`,
    ].join('\n')
  }

  debugOutput.textContent = sections.map(renderSection).join('\n\n')
  debugSection.classList.remove('hidden')
}

// ── Boot ─────────────────────────────────────────────────────────────────────
init()
