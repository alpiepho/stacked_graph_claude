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
