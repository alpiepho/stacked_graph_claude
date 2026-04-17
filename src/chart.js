import Chart from 'chart.js/auto'
import { Tooltip } from 'chart.js'

// Tooltip positioner: float to the side of the cursor, never over the bar
Tooltip.positioners.side = function(elements, eventPosition) {
  if (!elements.length) return false
  const { chartArea } = this.chart
  const midX = (chartArea.left + chartArea.right) / 2
  const { x, y } = eventPosition
  return x <= midX
    ? { x: x + 18, y, xAlign: 'left',  yAlign: 'center' }
    : { x: x - 18, y, xAlign: 'right', yAlign: 'center' }
}

const COLORS = [
  '#4ecca3', '#e94560', '#54a0ff', '#ffd32a', '#ff9f43',
  '#ee5a24', '#0652DD', '#9980FA', '#833471', '#1289A7'
]

// Stable label→color map: each series label gets a color on first appearance and keeps it.
const _labelColorMap = new Map()
let _nextColorIdx = 0

function getColor(label) {
  if (!_labelColorMap.has(label)) {
    _labelColorMap.set(label, COLORS[_nextColorIdx % COLORS.length])
    _nextColorIdx++
  }
  return _labelColorMap.get(label)
}

const LINE_META = [
  { key: 'income',   label: 'Income line',   color: '#2ecc71' },
  { key: 'expenses', label: 'Expenses line',  color: '#ff6b6b' },
  { key: 'net',      label: 'Net line',       color: '#f0f0f0' },
]

/** @type {Chart|null} */
let chartInstance = null

/**
 * Render or re-render the stacked bar chart with optional overlay lines.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} legendContainer
 * @param {{ months: string[], series: Array<{label: string, data: number[]}> }} chartData
 * @param {string[]} hiddenSeries - labels of bar series that should start hidden
 * @param {function(string, boolean): void} onLegendToggle - called with (label, isVisible)
 * @param {{ income: number[], expenses: number[], net: number[] }} lineData - per-month line values
 * @param {{ income: boolean, expenses: boolean, net: boolean }} linesVisible
 * @param {function(string, boolean): void} onLineToggle - called with (key, isVisible)
 * @param {function(string|null, string|null): void} [onElementHover] - called with (month, seriesLabel) on hover; null when leaving
 * @param {string[]} disabledSeries - series labels shown as grayed-out in legend (CC accounts when replace is off)
 */
export function renderChart(
  canvas, legendContainer,
  { months, series },
  hiddenSeries, onLegendToggle,
  lineData, linesVisible, onLineToggle,
  onElementHover,
  disabledSeries = []
) {
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

  // Bar datasets
  const barDatasets = series.map((s) => ({
    type: 'bar',
    label: s.label,
    data: s.data,
    backgroundColor: getColor(s.label),
    stack: 'main',
    hidden: hiddenSeries.includes(s.label)
  }))

  // Line overlay datasets (income, expenses, net)
  // Each line gets a unique stack group so the stacked y-axis doesn't accumulate them.
  const lineDatasets = LINE_META.map(({ key, label, color }) => ({
    type: 'line',
    label,
    data: lineData[key],
    borderColor: color,
    backgroundColor: color,
    pointBackgroundColor: color,
    pointRadius: 5,
    pointHoverRadius: 9,
    borderWidth: 2,
    fill: false,
    tension: 0.3,
    hidden: !linesVisible[key],
    order: -1,  // draw lines on top of bars
    stack: `_line_${key}`, // unique group — prevents stacking with bars or other lines
  }))

  const datasets = [...barDatasets, ...lineDatasets]

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
          position: 'side',
          mode: 'index',
          intersect: false,
          // Exclude datasets that are currently hidden in the legend
          filter: item => !chartInstance?.getDatasetMeta(item.datasetIndex).hidden,
          callbacks: {
            // Always use the stable full color, not the dimmed hover color
            labelColor: item => {
              const color = item.dataset.type === 'bar'
                ? getColor(item.dataset.label)
                : item.dataset.borderColor
              return { borderColor: color, backgroundColor: color }
            },
            label: item => ` ${item.dataset.label}: $${item.parsed.y.toFixed(2)}`,
            footer: items => {
              const barItems = items.filter(i => i.dataset.type === 'bar')
              if (barItems.length === 0) return undefined
              const total = barItems.reduce((sum, i) => sum + i.parsed.y, 0)
              return `Bar total: $${total.toFixed(2)}`
            }
          }
        }
      },
      onHover: (_event, activeElements) => {
        if (!chartInstance) return
        if (activeElements.length === 0) {
          chartInstance.data.datasets.forEach((ds) => {
            if (ds.type === 'bar') ds.backgroundColor = getColor(ds.label)
          })
          onElementHover?.(null, null)
        } else {
          const el = activeElements[0]
          const hoveredIdx = el.datasetIndex
          chartInstance.data.datasets.forEach((ds, i) => {
            if (ds.type !== 'bar') return
            ds.backgroundColor = i === hoveredIdx
              ? getColor(ds.label)
              : getColor(ds.label) + '33'
          })
          onElementHover?.(months[el.index], datasets[hoveredIdx]?.label ?? null)
        }
        chartInstance.update('none')
      }
    }
  })

  _renderLegend(legendContainer, barDatasets, lineDatasets, onLegendToggle, onLineToggle, disabledSeries)
}

/**
 * @param {HTMLElement} container
 * @param {Object[]} barDatasets
 * @param {Object[]} lineDatasets
 * @param {function(string, boolean): void} onBarToggle
 * @param {function(string, boolean): void} onLineToggle
 * @param {string[]} disabledSeries - CC account names to show as grayed-out (not in chart)
 */
function _renderLegend(container, barDatasets, lineDatasets, onBarToggle, onLineToggle, disabledSeries = []) {
  container.innerHTML = ''

  // Bar entries
  barDatasets.forEach((ds, i) => {
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
      onBarToggle(ds.label, cb.checked)
    })

    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.background = getColor(ds.label)

    const label = document.createElement('span')
    label.textContent = ds.label

    row.append(cb, swatch, label)
    container.appendChild(row)
  })

  // Disabled CC series (shown grayed out when "Replace CU CC payments" is off)
  disabledSeries.forEach(label => {
    const row = document.createElement('div')
    row.className = 'legend-row disabled'
    row.title = 'Enable "Replace CU credit card payment with CC details" to show these accounts'

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = false
    cb.disabled = true

    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.background = 'var(--muted)'

    const labelEl = document.createElement('span')
    labelEl.textContent = label

    row.append(cb, swatch, labelEl)
    container.appendChild(row)
  })

  // Separator between bars and lines
  const sep = document.createElement('div')
  sep.className = 'legend-separator'
  container.appendChild(sep)

  // Line entries
  lineDatasets.forEach((ds, j) => {
    const datasetIndex = barDatasets.length + j
    const row = document.createElement('div')
    row.className = 'legend-row'

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = !ds.hidden
    cb.addEventListener('change', () => {
      if (chartInstance) {
        chartInstance.setDatasetVisibility(datasetIndex, cb.checked)
        chartInstance.update()
      }
      onLineToggle(LINE_META[j].key, cb.checked)
    })

    const lineSwatch = document.createElement('span')
    lineSwatch.className = 'legend-line-swatch'
    lineSwatch.style.borderColor = ds.borderColor

    const dot = document.createElement('span')
    dot.className = 'legend-line-dot'
    dot.style.background = ds.borderColor

    const label = document.createElement('span')
    label.textContent = ds.label

    row.append(cb, lineSwatch, dot, label)
    container.appendChild(row)
  })
}
