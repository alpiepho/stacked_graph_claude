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
