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
 * Generate realistic sample financial CSV data covering 12 months.
 * Includes checking account (CU) and two credit cards.
 * @returns {string} CSV text
 */
export function generateSampleData() {
  const header = 'statement_type,statement_date,account,entry_type,transaction_date,effective_date,category,description,amount'
  const rows = []
  const year = 2024

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const d = (day) => `${year}-${mm}-${String(day).padStart(2, '0')}`

    // Income: paycheck deposited to checking
    rows.push(`checking,${d(1)},Salary,credit,${d(1)},${d(1)},Income,Monthly Salary,3500.00`)

    // Rent from checking
    rows.push(`checking,${d(1)},Rent,debit,${d(1)},${d(1)},Housing,Apartment Rent,-1200.00`)

    // Checking pays Visa (CU credit card payment)
    rows.push(`checking,${d(15)},Visa Payment,debit,${d(15)},${d(15)},CC Payment,credit card payment,-650.00`)

    // Checking pays Mastercard (CU credit card payment)
    rows.push(`checking,${d(16)},MC Payment,debit,${d(16)},${d(16)},CC Payment,credit card payment,-350.00`)

    // Visa transactions
    rows.push(`credit_card,${d(5)},visa_card,debit,${d(5)},${d(5)},Groceries,Whole Foods,-200.00`)
    rows.push(`credit_card,${d(12)},visa_card,debit,${d(12)},${d(12)},Dining,Restaurant,-150.00`)
    rows.push(`credit_card,${d(20)},visa_card,debit,${d(20)},${d(20)},Entertainment,Netflix,-50.00`)
    rows.push(`credit_card,${d(22)},visa_card,debit,${d(22)},${d(22)},Shopping,Amazon,-250.00`)

    // Mastercard transactions
    rows.push(`credit_card,${d(8)},mastercard,debit,${d(8)},${d(8)},Utilities,Electric Bill,-120.00`)
    rows.push(`credit_card,${d(18)},mastercard,debit,${d(18)},${d(18)},Groceries,Trader Joes,-130.00`)
    rows.push(`credit_card,${d(25)},mastercard,debit,${d(25)},${d(25)},Gas,Shell Gas,-100.00`)
  }

  return [header, ...rows].join('\n')
}
