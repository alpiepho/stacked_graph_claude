// Substrings in account name that identify a credit union (checking/savings) account
const CU_ACCOUNT_KEYWORDS = ['checking', 'savings']
// Substrings in description that identify a CU row as a CC payment (fallback)
const CU_CC_PAYMENT_KEYWORDS = ['credit card', 'card payment', 'cc payment']

/**
 * Derive which statement_type values correspond to CC accounts by scanning for
 * entry_type values like 'transaction-chase_am' — the suffix is the CC statement_type.
 * @param {Object[]} rows
 * @returns {Set<string>}
 */
export function getCCStatementTypes(rows) {
  const types = new Set()
  rows.forEach(r => {
    const et = (r.entry_type ?? '').toLowerCase()
    if (et.startsWith('transaction-')) types.add(et.slice('transaction-'.length))
  })
  return types
}

/**
 * Returns true if this row belongs to a CC account.
 * Uses statement_type matched against the set derived from entry_type suffixes.
 * @param {Object} row
 * @param {Set<string>} ccStatementTypes
 */
export function isCCRow(row, ccStatementTypes) {
  return ccStatementTypes.has((row.statement_type ?? '').toLowerCase())
}

/** @param {Object} row */
export function isCUCCPayment(row) {
  // Primary: entry_type like 'transaction-chase_am' unambiguously signals a CU-side CC payment
  const entryType = (row.entry_type ?? '').toLowerCase()
  if (entryType.startsWith('transaction-')) return true
  // Fallback: CU account with description keyword match
  const account = (row.account ?? '').toLowerCase()
  if (!CU_ACCOUNT_KEYWORDS.some(kw => account.includes(kw))) return false
  const desc = (row.description ?? '').toLowerCase()
  return CU_CC_PAYMENT_KEYWORDS.some(kw => desc.includes(kw))
}

/**
 * Extract the target CC account statement_type from a CU CC payment row.
 * Returns the suffix after 'transaction-', or null if not encoded in entry_type.
 * @param {Object} row
 * @returns {string|null}
 */
export function getCUCCPaymentTarget(row) {
  const entryType = (row.entry_type ?? '').toLowerCase()
  if (entryType.startsWith('transaction-')) return entryType.slice('transaction-'.length)
  return null
}

/**
 * Get all unique CC account names from rows.
 * @param {Object[]} rows
 * @returns {string[]}
 */
export function getCCAccounts(rows) {
  const ccTypes = getCCStatementTypes(rows)
  return [...new Set(rows.filter(r => isCCRow(r, ccTypes)).map(r => r.account).filter(Boolean))]
}

/**
 * Apply user-selected filters to the full row set.
 * @param {Object[]} rows
 * @param {{ replaceCUPay: boolean }} filters
 * @returns {Object[]}
 */
export function applyFilters(rows, { replaceCUPay }) {
  const ccTypes = getCCStatementTypes(rows)

  // Only graph transaction entries; skip balance/other entries
  // Accepts 'transaction' and 'transaction-*' (e.g. 'transaction-chase_am')
  let filtered = rows.filter(r => r.entry_type?.toLowerCase().startsWith('transaction'))

  if (replaceCUPay) {
    // Show CC details: remove CU-side CC payment rows (they'd double-count)
    filtered = filtered.filter(r => !isCUCCPayment(r))
  } else {
    // Hide CC detail rows: CU payment rows represent the total CC spend
    filtered = filtered.filter(r => !isCCRow(r, ccTypes))
  }

  return filtered
}
