import './style.css'
import { parseCSV, detectDateColumn, generateSampleData } from './csv.js'
import { aggregate } from './aggregate.js'
import { applyFilters, getCCAccounts } from './filters.js'
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
