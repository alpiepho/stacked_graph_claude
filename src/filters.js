// Configurable constants — update these to match your actual statement_type values
const CC_STATEMENT_TYPES = ['credit_card']
const CU_STATEMENT_TYPES = ['checking', 'savings']
// Substrings in description that identify a CU row as a CC payment
const CU_CC_PAYMENT_KEYWORDS = ['credit card', 'card payment', 'cc payment']

/** @param {Object} row */
export function isCCRow(row) {
  return CC_STATEMENT_TYPES.includes(row.statement_type?.toLowerCase())
}

/** @param {Object} row */
export function isCUCCPayment(row) {
  if (!CU_STATEMENT_TYPES.includes(row.statement_type?.toLowerCase())) return false
  const desc = (row.description ?? '').toLowerCase()
  return CU_CC_PAYMENT_KEYWORDS.some(kw => desc.includes(kw))
}

/**
 * Get all unique CC account names from rows.
 * @param {Object[]} rows
 * @returns {string[]}
 */
export function getCCAccounts(rows) {
  return [...new Set(rows.filter(isCCRow).map(r => r.account).filter(Boolean))]
}

/**
 * Apply user-selected filters to the full row set.
 * @param {Object[]} rows
 * @param {{ showAllCC: boolean, replaceCUPay: boolean, pickedCC: string[] }} filters
 * @returns {Object[]}
 */
export function applyFilters(rows, { showAllCC, replaceCUPay, pickedCC }) {
  let filtered = rows

  // Remove CU rows that are CC payments
  if (replaceCUPay) {
    filtered = filtered.filter(r => !isCUCCPayment(r))
  }

  // Combine all CC accounts into one series
  if (!showAllCC) {
    filtered = filtered.map(r =>
      isCCRow(r) ? { ...r, account: 'Credit Cards' } : r
    )
  }

  // Keep only picked CC accounts (empty pickedCC = include all)
  if (pickedCC.length > 0) {
    filtered = filtered.filter(r => !isCCRow(r) || pickedCC.includes(r.account))
  }

  return filtered
}
