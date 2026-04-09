/**
 * Calculate income, expenses, and net totals + monthly averages.
 * Income = sum of positive amounts. Expenses = absolute sum of negative amounts.
 * @param {Object[]} rows
 * @param {string} dateCol - used to count distinct months for monthly average
 * @returns {{
 *   income:   { total: number, monthly: number },
 *   expenses: { total: number, monthly: number },
 *   net:      { total: number, monthly: number }
 * }}
 */
export function calcSummary(rows, dateCol) {
  let totalIncome = 0
  let totalExpenses = 0
  const months = new Set()

  for (const row of rows) {
    const amount = parseFloat(row.amount) || 0
    const month = row[dateCol]?.slice(0, 7)
    if (month) months.add(month)
    if (amount > 0) totalIncome += amount
    else totalExpenses += Math.abs(amount)
  }

  const monthCount = months.size || 1
  const totalNet = totalIncome - totalExpenses

  return {
    income:   { total: totalIncome,   monthly: totalIncome   / monthCount },
    expenses: { total: totalExpenses, monthly: totalExpenses / monthCount },
    net:      { total: totalNet,      monthly: totalNet      / monthCount }
  }
}
