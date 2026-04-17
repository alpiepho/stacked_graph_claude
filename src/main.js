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
const replaceCUCb    = document.getElementById('filter-replace-cu')
const filterCCCreditsCb = document.getElementById('filter-cc-credits')
const chartCanvas  = document.getElementById('chart-canvas')
const legendDiv    = document.getElementById('legend')
const summaryIncome   = document.getElementById('summary-income')
const summaryExpenses = document.getElementById('summary-expenses')
const summaryNet      = document.getElementById('summary-net')
const debugSection    = document.getElementById('debug-section')
const debugOutput     = document.getElementById('debug-output')
const debugToggle     = document.getElementById('debug-toggle')
const debugCopy       = document.getElementById('debug-copy')
const monthRangeWrap  = document.getElementById('month-range-wrap')
const rangeStartEl    = document.getElementById('range-start')
const rangeEndEl      = document.getElementById('range-end')
const rangeFillEl     = document.getElementById('range-fill')
const rangeStartLabel = document.getElementById('range-start-label')
const rangeEndLabel   = document.getElementById('range-end-label')

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
let _lastFullMonths = []    // all months before range slice (for slider labels)
let _dumpActive    = false  // true while a transaction dump is displayed; suppresses _showDebug overwrites
let _lastWorkingRows = []   // filtered rows after sign inversion (matches what the chart shows)

// Month range slider state
let _rangeStart    = 0
let _rangeEnd      = 0
let _lastMonthsKey = null   // detects when underlying month list changes → resets range
let _rangeTimer    = null

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
  filterCCCreditsCb.checked = settings.filters.filterCCCredits ?? false

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

// ── Month range slider ───────────────────────────────────────────────────────
function _initRange(months) {
  const max = Math.max(0, months.length - 1)
  rangeStartEl.min = rangeEndEl.min = 0
  rangeStartEl.max = rangeEndEl.max = max
  _rangeStart = 0
  _rangeEnd   = max
  rangeStartEl.value = 0
  rangeEndEl.value   = max
  monthRangeWrap.classList.toggle('hidden', months.length === 0)
  _updateRangeFill(months)
}

function _updateRangeFill(months) {
  const max = Math.max(1, months.length - 1)
  const s = _rangeStart, e = _rangeEnd
  rangeFillEl.style.left  = (s / max * 100) + '%'
  rangeFillEl.style.right = ((max - e) / max * 100) + '%'
  rangeStartLabel.textContent = months[s] ?? ''
  rangeEndLabel.textContent   = months[e] ?? ''
  // When handles meet or start is at max, keep start thumb on top so it stays grabbable
  rangeStartEl.style.zIndex = (s >= e) ? 3 : 2
  rangeEndEl.style.zIndex   = (s >= e) ? 2 : 3
}

rangeStartEl.addEventListener('input', () => {
  let s = parseInt(rangeStartEl.value)
  if (s > _rangeEnd) { s = _rangeEnd; rangeStartEl.value = s }
  _rangeStart = s
  _updateRangeFill(_lastFullMonths)
  clearTimeout(_rangeTimer)
  _rangeTimer = setTimeout(_render, 80)
})

rangeEndEl.addEventListener('input', () => {
  let e = parseInt(rangeEndEl.value)
  if (e < _rangeStart) { e = _rangeStart; rangeEndEl.value = e }
  _rangeEnd = e
  _updateRangeFill(_lastFullMonths)
  clearTimeout(_rangeTimer)
  _rangeTimer = setTimeout(_render, 80)
})

// ── Payment-based series ordering ────────────────────────────────────────────
/**
 * Scan rows to build: payer account → [CC accounts], and CC accounts in payment row order.
 */
function _buildPaymentOrder(allRows, stackCol) {
  const stmtToAcct = new Map()
  allRows.forEach(r => {
    const st = (r.statement_type ?? '').toLowerCase()
    if (st && r[stackCol]) stmtToAcct.set(st, r[stackCol])
  })

  const payerCCs = new Map() // payer account → ordered CC account names
  const ccOrder  = []        // all CC accounts in first-seen order across payment rows
  const seen     = new Set()

  allRows.forEach(r => {
    const et = (r.entry_type ?? '').toLowerCase()
    if (!et.startsWith('payment-')) return
    const ccAcct = stmtToAcct.get(et.slice('payment-'.length))
    const payer  = r[stackCol]
    if (!ccAcct || !payer) return
    if (!payerCCs.has(payer)) payerCCs.set(payer, [])
    const list = payerCCs.get(payer)
    if (!list.includes(ccAcct)) list.push(ccAcct)
    if (!seen.has(ccAcct)) { ccOrder.push(ccAcct); seen.add(ccAcct) }
  })

  return { payerCCs, ccOrder }
}

/** Reorder chart series so CC accounts appear just below their payer in the stack. */
function _reorderSeries(series, allRows, stackCol) {
  const { payerCCs } = _buildPaymentOrder(allRows, stackCol)
  const handledCCs   = new Set([...payerCCs.values()].flat())
  const byLabel      = new Map(series.map(s => [s.label, s]))
  const result = [], placed = new Set()

  for (const s of series) {
    if (placed.has(s.label) || handledCCs.has(s.label)) continue
    // Insert this payer's CC accounts just before it in the stack
    for (const cc of (payerCCs.get(s.label) ?? [])) {
      const ccS = byLabel.get(cc)
      if (ccS && !placed.has(cc)) { result.push(ccS); placed.add(cc) }
    }
    result.push(s); placed.add(s.label)
  }
  // Any remaining (CC without known payer in current series)
  for (const s of series) if (!placed.has(s.label)) result.push(s)
  return result
}

/**
 * Build a combined ordered legend list interleaving active series and disabled CC entries.
 * Each disabled CC account appears just before its payer in the list.
 * @returns {Array<{label: string, disabled: boolean}>}
 */
function _buildCombinedLegendOrder(activeSeries, disabledAccounts, allRows, stackCol) {
  if (disabledAccounts.length === 0) {
    return activeSeries.map(s => ({ label: s.label, disabled: false }))
  }
  const { payerCCs } = _buildPaymentOrder(allRows, stackCol)
  const disabledSet = new Set(disabledAccounts)
  const result = [], placed = new Set()

  for (const s of activeSeries) {
    for (const cc of (payerCCs.get(s.label) ?? [])) {
      if (disabledSet.has(cc) && !placed.has(cc)) {
        result.push({ label: cc, disabled: true })
        placed.add(cc)
      }
    }
    result.push({ label: s.label, disabled: false })
    placed.add(s.label)
  }
  // Any disabled accounts whose payer isn't in the active series
  for (const a of disabledAccounts) {
    if (!placed.has(a)) result.push({ label: a, disabled: true })
  }
  return result
}

// ── Rendering ────────────────────────────────────────────────────────────────
function _render() {
  const dateCol  = dateColSel.value
  const stackCol = stackColSel.value

  const replaceCUPay    = replaceCUCb.checked
  const filterCCCredits = filterCCCreditsCb.checked
  const filtered = applyFilters(rows, { replaceCUPay, filterCCCredits })
  const disabledAccounts = replaceCUPay ? [] : getCCAccounts(rows)

  const workingRows = filtered

  const fullChartData = aggregate(workingRows, dateCol, stackCol)
  // Reorder series so CC accounts stack just below the account that pays them
  fullChartData.series = _reorderSeries(fullChartData.series, rows, stackCol)

  // Build combined legend order: active + disabled CC entries interleaved at correct positions
  const legendOrder = _buildCombinedLegendOrder(fullChartData.series, disabledAccounts, rows, stackCol)

  // Reset range when the underlying months list changes (new data loaded)
  const monthsKey = `${fullChartData.months[0]}..${fullChartData.months[fullChartData.months.length - 1]}:${fullChartData.months.length}`
  if (monthsKey !== _lastMonthsKey) {
    _lastMonthsKey = monthsKey
    _initRange(fullChartData.months)
  }
  _lastFullMonths = fullChartData.months

  // Slice to selected range
  const rs = Math.min(_rangeStart, Math.max(0, fullChartData.months.length - 1))
  const re = Math.min(_rangeEnd,   Math.max(0, fullChartData.months.length - 1))
  const chartData = {
    months: fullChartData.months.slice(rs, re + 1),
    series: fullChartData.series.map(s => ({ ...s, data: s.data.slice(rs, re + 1) }))
  }

  _lastFiltered    = filtered
  _lastWorkingRows = workingRows
  _lastDateCol     = dateCol
  _lastStackCol    = stackCol
  _lastChartData   = chartData
  _showDebug(rows, filtered, dateCol, stackCol, fullChartData, { replaceCUPay })

  // Rows for lines/summary: exclude hidden series AND restrict to selected month range
  const rangedMonths = new Set(chartData.months)
  const hiddenSet  = new Set(settings.hiddenSeries ?? [])
  const visibleRows = workingRows.filter(row =>
    !hiddenSet.has(row[stackCol]) && rangedMonths.has(row[dateCol]?.slice(0, 7))
  )

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
    legendOrder
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
  settings.filters = { replaceCUPay: replaceCUCb.checked, filterCCCredits: filterCCCreditsCb.checked }
  save('filters', settings.filters)
  _render()
}

replaceCUCb.addEventListener('change', _onFilterChange)
filterCCCreditsCb.addEventListener('change', _onFilterChange)

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
    `  Filter CC credits: ${filters.filterCCCredits}`,
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

  debugSection.classList.remove('hidden')  // reveal container; leave output collapsed/expanded as-is
}

debugToggle.addEventListener('click', () => {
  const collapsed = debugOutput.classList.toggle('hidden')
  debugToggle.textContent = (collapsed ? '▶' : '▼') + ' Debug info'
  if (collapsed) _dumpActive = false
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

    _showTransactionDump(sections, 'Accounts')
  }

  if (key === 'c') {
    if (!_hoveredMonth || _lastWorkingRows.length === 0) return

    // All transactions for the hovered month (enabled series only), then one section per category
    const monthRows = _lastWorkingRows.filter(row =>
      row[_lastDateCol]?.slice(0, 7) === _hoveredMonth && isVisible(row)
    )
    const sections = [{ title: `All transactions — ${_hoveredMonth}`, rows: monthRows }]

    // Gather categories in order of first appearance
    const catOrder = []
    const catSeen  = new Set()
    monthRows.forEach(row => {
      const cat = row.category ?? ''
      if (!catSeen.has(cat)) { catOrder.push(cat); catSeen.add(cat) }
    })

    for (const cat of catOrder) {
      const txRows = monthRows.filter(row => (row.category ?? '') === cat)
      if (txRows.length > 0) {
        sections.push({ title: `"${cat || '(no category)'}" — ${_hoveredMonth}`, rows: txRows })
      }
    }

    _showTransactionDump(sections, 'Categories')
  }
})

function _showTransactionDump(sections, summaryLabel = null) {
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

  let output = sections.map(renderSection).join('\n\n')

  // Condensed summary (skips the first "All transactions" section)
  if (summaryLabel && sections.length > 1) {
    const detailSections = sections.slice(1)
    const labelW = 32, amtW = 12
    const summaryLines = detailSections.map(({ title, rows: txRows }) => {
      const net    = txRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      const netStr = (net >= 0 ? '+' : '') + net.toFixed(2)
      const label  = title.replace(/^"(.+)"\s*—.*$/, '$1')
      return `  ${label.padEnd(labelW)}  ${netStr.padStart(amtW)}`
    })
    const grandNet    = detailSections.reduce((s, { rows: txRows }) =>
      s + txRows.reduce((ss, r) => ss + (parseFloat(r.amount) || 0), 0), 0)
    const grandStr    = (grandNet >= 0 ? '+' : '') + grandNet.toFixed(2)
    const SSEP        = '  ' + '─'.repeat(labelW + amtW + 2)
    output += '\n\n' + [
      `── Summary: ${summaryLabel} ──`,
      SSEP,
      ...summaryLines,
      SSEP,
      `  ${'Total'.padEnd(labelW)}  ${grandStr.padStart(amtW)}`,
    ].join('\n')
  }

  debugOutput.textContent = output
  debugSection.classList.remove('hidden')
  debugOutput.classList.remove('hidden')
  debugToggle.textContent = '▼ Debug info'
}

// ── Boot ─────────────────────────────────────────────────────────────────────
init()
