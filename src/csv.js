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
 * Includes 10 accounts: 3 bank/CU, 4 credit cards, 3 other.
 * Amounts vary month-to-month using a fixed seed for reproducibility.
 * @returns {string} CSV text
 */
export function generateSampleData() {
  const header = 'statement_type,statement_date,account,entry_type,transaction_date,effective_date,category,description,amount'
  const rows = []
  const year = 2024
  const rnd = seededRandom(42)
  const vary = (base, pct) => (base * (1 + (rnd() - 0.5) * 2 * pct)).toFixed(2)
  const row = (acct, day, cat, desc, amt, mm) => {
    const dt = `${year}-${mm}-${String(day).padStart(2, '0')}`
    return `transaction,${dt},${acct},transaction,${dt},${dt},${cat},${desc},${amt}`
  }

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')

    // Seasonal factors
    const seasonal  = [6, 7, 8].includes(m) ? 1.2 : [11, 12].includes(m) ? 1.35 : 1.0
    const coldMonth = [1, 2, 11, 12].includes(m)
    const hotMonth  = [6, 7, 8].includes(m)

    // ── Checking (main CU) ──────────────────────────────────────────────────
    rows.push(row('Checking', 1,  'Income',   'Monthly Salary',       '3500.00',               mm))
    rows.push(row('Checking', 1,  'Housing',  'Apartment Rent',       '-1200.00',              mm))
    rows.push(row('Checking', 14, 'Transfer', 'Transfer to Savings',  '-500.00',               mm))

    // ── Savings ─────────────────────────────────────────────────────────────
    rows.push(row('Savings',  14, 'Transfer', 'Transfer from Checking', '500.00',              mm))
    rows.push(row('Savings',  28, 'Interest', 'Monthly Interest',      vary(9, 0.25),           mm))

    // ── Business Checking ───────────────────────────────────────────────────
    const consulting = vary(2200 * (rnd() > 0.25 ? 1 : 0.5), 0.40) // occasional low months
    rows.push(row('Business Checking', 5,  'Income',  'Consulting Payment',    consulting,    mm))
    rows.push(row('Business Checking', 10, 'Software','SaaS Subscriptions',   `-${vary(140, 0.25)}`, mm))
    rows.push(row('Business Checking', 20, 'Office',  'Office Supplies',      `-${vary(65, 0.55)}`,  mm))

    // ── visa_card ───────────────────────────────────────────────────────────
    const visa_groceries = vary(210 * seasonal, 0.30)
    const visa_dining    = vary(140 * seasonal, 0.55)
    const visa_amazon    = vary(180 * seasonal, 0.65)
    rows.push(row('visa_card', 4,  'Groceries', 'Whole Foods',          `-${visa_groceries}`,  mm))
    rows.push(row('visa_card', 11, 'Dining',    'Restaurants',          `-${visa_dining}`,     mm))
    rows.push(row('visa_card', 19, 'Shopping',  'Amazon',               `-${visa_amazon}`,     mm))

    // ── mastercard ──────────────────────────────────────────────────────────
    const electricBase  = coldMonth ? 175 : hotMonth ? 155 : 85
    const mc_electric   = vary(electricBase, 0.18)
    const mc_groceries  = vary(120 * seasonal, 0.35)
    const mc_clothing   = vary(90 * seasonal, 0.70)
    rows.push(row('mastercard', 6,  'Utilities', 'Electric Bill',        `-${mc_electric}`,    mm))
    rows.push(row('mastercard', 13, 'Groceries', 'Trader Joes',          `-${mc_groceries}`,   mm))
    rows.push(row('mastercard', 22, 'Clothing',  'Department Store',     `-${mc_clothing}`,    mm))

    // ── discover_card ───────────────────────────────────────────────────────
    const disc_gas       = vary(95, 0.40)
    const disc_streaming = '15.99'  // fixed
    const disc_dining    = vary(75 * seasonal, 0.50)
    rows.push(row('discover_card', 3,  'Gas',           'Shell Gas',     `-${disc_gas}`,       mm))
    rows.push(row('discover_card', 15, 'Streaming',     'Hulu',          `-${disc_streaming}`, mm))
    rows.push(row('discover_card', 21, 'Dining',        'Fast Food',     `-${disc_dining}`,    mm))

    // ── amex_card ───────────────────────────────────────────────────────────
    const amex_gym      = '79.00'  // fixed membership
    const amex_dining   = vary(110 * seasonal, 0.50)
    const amex_travel   = [3, 7, 9, 11].includes(m) ? `-${vary(420, 0.35)}` : null // travel months
    rows.push(row('amex_card', 2,  'Health',   'Gym Membership',        `-${amex_gym}`,        mm))
    rows.push(row('amex_card', 16, 'Dining',   'Fine Dining',           `-${amex_dining}`,     mm))
    if (amex_travel) rows.push(row('amex_card', 23, 'Travel', 'Hotel / Airfare', amex_travel, mm))

    // ── PayPal ──────────────────────────────────────────────────────────────
    const paypal_purchase = vary(85, 0.75)
    if (rnd() > 0.30) rows.push(row('PayPal', 9, 'Shopping', 'eBay Purchase', `-${paypal_purchase}`, mm))
    rows.push(row('PayPal', 24, 'Services', 'Online Services', `-${vary(28, 0.45)}`, mm))

    // ── Venmo ───────────────────────────────────────────────────────────────
    rows.push(row('Venmo', 1,  'Transfer', 'Roommate Rent Split',  `${vary(650, 0.04)}`, mm))
    rows.push(row('Venmo', 17, 'Dining',   'Group Dinner Split',  `-${vary(38, 0.55)}`, mm))

    // ── Investment ──────────────────────────────────────────────────────────
    rows.push(row('Investment', 15, 'Dividends', 'Dividend Income',      vary(130, 0.30),       mm))
    rows.push(row('Investment', 15, 'Deposit',   'Monthly Contribution', vary(300, 0.10),       mm))

    // ── CU CC payments from Checking (match actual CC spend) ────────────────
    const visaTotal = (parseFloat(visa_groceries) + parseFloat(visa_dining) + parseFloat(visa_amazon)).toFixed(2)
    const mcTotal   = (parseFloat(mc_electric) + parseFloat(mc_groceries) + parseFloat(mc_clothing)).toFixed(2)
    const discTotal = (parseFloat(disc_gas) + parseFloat(disc_streaming) + parseFloat(disc_dining)).toFixed(2)
    const amexTotal = (parseFloat(amex_gym) + parseFloat(amex_dining) + (amex_travel ? parseFloat(amex_travel.replace('-','')) : 0)).toFixed(2)
    rows.push(row('Checking', 15, 'CC Payment', 'credit card payment', `-${visaTotal}`, mm))
    rows.push(row('Checking', 16, 'CC Payment', 'credit card payment', `-${mcTotal}`,   mm))
    rows.push(row('Checking', 17, 'CC Payment', 'credit card payment', `-${discTotal}`, mm))
    rows.push(row('Checking', 18, 'CC Payment', 'credit card payment', `-${amexTotal}`, mm))

    // ── Balance rows — not graphed (entry_type=balance) ─────────────────────
    rows.push(`balance,${year}-${mm}-28,Checking,balance,${year}-${mm}-28,${year}-${mm}-28,Balance,End of Month Balance,${vary(8000, 0.15)}`)
  }

  return [header, ...rows].join('\n')
}
