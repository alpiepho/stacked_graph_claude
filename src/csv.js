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

/**
 * Pick the best stack-by column from a list of headers.
 * Prefers 'account', then 'category', then first column.
 * @param {string[]} headers
 * @returns {string}
 */
export function detectStackColumn(headers) {
  if (headers.includes('account')) return 'account'
  if (headers.includes('category')) return 'category'
  return headers[0]
}

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Returns a function that yields floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate realistic sample financial CSV data covering 12 months.
 * Includes checking account (CU) and two credit cards.
 * Amounts vary month-to-month using a fixed seed for reproducibility.
 * @returns {string} CSV text
 */
export function generateSampleData() {
  const header = 'statement_type,statement_date,account,entry_type,transaction_date,effective_date,category,description,amount'
  const rows = []
  const year = 2024
  const rnd = seededRandom(42)
  // Return a varied amount: base ± (pct * base), always positive
  const vary = (base, pct) => (base * (1 + (rnd() - 0.5) * 2 * pct)).toFixed(2)

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const d = (day) => `${year}-${mm}-${String(day).padStart(2, '0')}`

    // Seasonal factor: higher spending in summer (6-8) and winter (11-12)
    const seasonal = [6, 7, 8].includes(m) ? 1.2 : [11, 12].includes(m) ? 1.3 : 1.0

    // Income: paycheck deposited to checking (fixed)
    rows.push(`transaction,${d(1)},Checking,transaction,${d(1)},${d(1)},Income,Monthly Salary,3500.00`)

    // Rent from checking (fixed)
    rows.push(`transaction,${d(1)},Checking,transaction,${d(1)},${d(1)},Housing,Apartment Rent,-1200.00`)

    // Visa transactions (varying)
    const groceries = vary(200 * seasonal, 0.30)
    const restaurant = vary(150 * seasonal, 0.50)
    const netflix    = '50.00'
    const amazon     = vary(250 * seasonal, 0.60)
    rows.push(`transaction,${d(5)},visa_card,transaction,${d(5)},${d(5)},Groceries,Whole Foods,-${groceries}`)
    rows.push(`transaction,${d(12)},visa_card,transaction,${d(12)},${d(12)},Dining,Restaurant,-${restaurant}`)
    rows.push(`transaction,${d(20)},visa_card,transaction,${d(20)},${d(20)},Entertainment,Netflix,-${netflix}`)
    rows.push(`transaction,${d(22)},visa_card,transaction,${d(22)},${d(22)},Shopping,Amazon,-${amazon}`)

    // Mastercard transactions (varying; electric bill peaks in winter/summer)
    const electricBase = [6, 7, 8, 11, 12, 1, 2].includes(m) ? 160 : 90
    const electric   = vary(electricBase, 0.20)
    const traderjoes = vary(130 * seasonal, 0.35)
    const gas        = vary(100, 0.40)
    rows.push(`transaction,${d(8)},mastercard,transaction,${d(8)},${d(8)},Utilities,Electric Bill,-${electric}`)
    rows.push(`transaction,${d(18)},mastercard,transaction,${d(18)},${d(18)},Groceries,Trader Joes,-${traderjoes}`)
    rows.push(`transaction,${d(25)},mastercard,transaction,${d(25)},${d(25)},Gas,Shell Gas,-${gas}`)

    // CU CC payments — match the actual CC spend so replaceCUPay gives accurate totals
    const visaTotal = (parseFloat(groceries) + parseFloat(restaurant) + parseFloat(netflix) + parseFloat(amazon)).toFixed(2)
    const mcTotal   = (parseFloat(electric) + parseFloat(traderjoes) + parseFloat(gas)).toFixed(2)
    rows.push(`transaction,${d(15)},Checking,transaction,${d(15)},${d(15)},CC Payment,credit card payment,-${visaTotal}`)
    rows.push(`transaction,${d(16)},Checking,transaction,${d(16)},${d(16)},CC Payment,credit card payment,-${mcTotal}`)

    // Balance rows — informational only, not graphed
    rows.push(`balance,${d(28)},Checking,transaction,${d(28)},${d(28)},Balance,End of Month Balance,${(2000 + m * 50).toFixed(2)}`)
  }

  return [header, ...rows].join('\n')
}
