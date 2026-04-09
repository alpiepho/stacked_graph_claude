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
