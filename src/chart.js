import Chart from 'chart.js/auto'

const COLORS = [
  '#4ecca3', '#e94560', '#54a0ff', '#ffd32a', '#ff9f43',
  '#ee5a24', '#0652DD', '#9980FA', '#833471', '#1289A7'
]

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
 * @param {string[]} invertedAccounts - series labels whose amounts are currently inverted
 * @param {function(string): void} onInvertToggle - called with series label when ± is clicked
 */
export function renderChart(
  canvas, legendContainer,
  { months, series },
  hiddenSeries, onLegendToggle,
  lineData, linesVisible, onLineToggle,
  onElementHover,
  invertedAccounts, onInvertToggle
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
  const barDatasets = series.map((s, i) => ({
    type: 'bar',
    label: s.label,
    data: s.data,
    backgroundColor: COLORS[i % COLORS.length],
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
          mode: 'index',
          intersect: false,
          callbacks: {
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
          chartInstance.data.datasets.forEach((ds, i) => {
            if (ds.type === 'bar') ds.backgroundColor = COLORS[i % COLORS.length]
          })
          onElementHover?.(null, null)
        } else {
          const el = activeElements[0]
          const hoveredIdx = el.datasetIndex
          chartInstance.data.datasets.forEach((ds, i) => {
            if (ds.type !== 'bar') return
            ds.backgroundColor = i === hoveredIdx
              ? COLORS[i % COLORS.length]
              : COLORS[i % COLORS.length] + '33'
          })
          onElementHover?.(months[el.index], datasets[hoveredIdx]?.label ?? null)
        }
        chartInstance.update('none')
      }
    }
  })

  _renderLegend(legendContainer, barDatasets, lineDatasets, onLegendToggle, onLineToggle, invertedAccounts ?? [], onInvertToggle)
}

/**
 * @param {HTMLElement} container
 * @param {Object[]} barDatasets
 * @param {Object[]} lineDatasets
 * @param {function(string, boolean): void} onBarToggle
 * @param {function(string, boolean): void} onLineToggle
 * @param {string[]} invertedAccounts
 * @param {function(string): void} onInvertToggle
 */
function _renderLegend(container, barDatasets, lineDatasets, onBarToggle, onLineToggle, invertedAccounts, onInvertToggle) {
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
    swatch.style.background = COLORS[i % COLORS.length]

    const label = document.createElement('span')
    label.textContent = ds.label

    const invertBtn = document.createElement('button')
    invertBtn.className = 'legend-invert-btn' + (invertedAccounts.includes(ds.label) ? ' active' : '')
    invertBtn.textContent = '±'
    invertBtn.title = 'Invert sign for this account (use for CC accounts where debits are positive)'
    invertBtn.addEventListener('click', e => {
      e.stopPropagation()
      onInvertToggle?.(ds.label)
    })

    row.append(cb, swatch, label, invertBtn)
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
