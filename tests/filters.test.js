import { describe, it, expect } from 'vitest'
import { isCCRow, isCUCCPayment, getCCAccounts, applyFilters, getCUCCPaymentTarget, getCCStatementTypes } from '../src/filters.js'

const sampleRows = [
  { statement_type: 'checking_statement', entry_type: 'transaction',            account: 'Checking',    description: 'Monthly Salary',      amount: '3500' },
  { statement_type: 'checking_statement', entry_type: 'transaction-visa_card',  account: 'Checking',    description: 'Visa Card Payment',   amount: '-650' },
  { statement_type: 'checking_statement', entry_type: 'transaction-mastercard', account: 'Checking',    description: 'Mastercard Payment',  amount: '-300' },
  { statement_type: 'checking_statement', entry_type: 'transaction',            account: 'Checking',    description: 'credit card payment', amount: '-100' },
  { statement_type: 'visa_card',          entry_type: 'transaction',            account: 'visa_card',   description: 'Whole Foods',         amount: '-200' },
  { statement_type: 'visa_card',          entry_type: 'transaction',            account: 'visa_card',   description: 'Netflix',             amount: '-50'  },
  { statement_type: 'mastercard',         entry_type: 'transaction',            account: 'mastercard',  description: 'Electric Bill',       amount: '-120' },
  { statement_type: 'checking_statement', entry_type: 'balance',               account: 'Checking',    description: 'End Balance',         amount: '10000' },
]

// CC statement_types derived from entry_type suffixes in sampleRows
const ccTypes = getCCStatementTypes(sampleRows)

describe('getCCStatementTypes', () => {
  it('derives CC statement_types from transaction-* entry_types', () => {
    expect([...ccTypes].sort()).toEqual(['mastercard', 'visa_card'])
  })
  it('returns empty set when no transaction-* entry_types present', () => {
    const types = getCCStatementTypes([sampleRows[0]])
    expect(types.size).toBe(0)
  })
})

describe('isCCRow', () => {
  it('returns true for a visa_card statement_type row', () => {
    expect(isCCRow(sampleRows[4], ccTypes)).toBe(true)
  })
  it('returns true for a mastercard statement_type row', () => {
    expect(isCCRow(sampleRows[6], ccTypes)).toBe(true)
  })
  it('returns false for checking account row', () => {
    expect(isCCRow(sampleRows[0], ccTypes)).toBe(false)
  })
  it('returns false for an account not in ccTypes (e.g. www.chase.com/amazon with no matching entry_type)', () => {
    const unknownRow = { statement_type: 'www.chase.com/amazon', entry_type: 'transaction', account: 'www.chase.com/amazon', amount: '-50' }
    expect(isCCRow(unknownRow, ccTypes)).toBe(false)
  })
})

describe('isCUCCPayment', () => {
  it('returns true when entry_type starts with "transaction-"', () => {
    expect(isCUCCPayment(sampleRows[1])).toBe(true)
  })
  it('returns true for description-keyword fallback on a CU account', () => {
    expect(isCUCCPayment(sampleRows[3])).toBe(true)
  })
  it('returns false for income row in checking account', () => {
    expect(isCUCCPayment(sampleRows[0])).toBe(false)
  })
  it('returns false for a CC row (entry_type is plain transaction)', () => {
    expect(isCUCCPayment(sampleRows[4])).toBe(false)
  })
})

describe('getCUCCPaymentTarget', () => {
  it('returns the card statement_type from entry_type suffix', () => {
    expect(getCUCCPaymentTarget(sampleRows[1])).toBe('visa_card')
  })
  it('returns null for a plain transaction', () => {
    expect(getCUCCPaymentTarget(sampleRows[0])).toBeNull()
  })
  it('returns null for a description-only CC payment', () => {
    expect(getCUCCPaymentTarget(sampleRows[3])).toBeNull()
  })
})

describe('getCCAccounts', () => {
  it('returns unique CC account names derived from entry_type suffixes', () => {
    const accounts = getCCAccounts(sampleRows)
    expect(accounts.sort()).toEqual(['mastercard', 'visa_card'])
  })
})

describe('applyFilters', () => {
  it('filters out balance rows before any other processing', () => {
    const result = applyFilters(sampleRows, { replaceCUPay: false })
    expect(result.find(r => r.entry_type === 'balance')).toBeUndefined()
  })

  it('replaceCUPay=false hides all CC rows (shown grayed-out in legend only)', () => {
    const result = applyFilters(sampleRows, { replaceCUPay: false })
    expect(result.find(r => r.account === 'visa_card')).toBeUndefined()
    expect(result.find(r => r.account === 'mastercard')).toBeUndefined()
  })

  it('replaceCUPay=false keeps CU-side payment rows (they represent total CC spend)', () => {
    const result = applyFilters(sampleRows, { replaceCUPay: false })
    expect(result.find(r => r.entry_type === 'transaction-visa_card')).toBeDefined()
    expect(result.find(r => r.description === 'credit card payment')).toBeDefined()
  })

  it('replaceCUPay=true shows CC detail rows', () => {
    const result = applyFilters(sampleRows, { replaceCUPay: true })
    expect(result.find(r => r.account === 'visa_card')).toBeDefined()
    expect(result.find(r => r.account === 'mastercard')).toBeDefined()
  })

  it('replaceCUPay=true removes CU credit card payment rows', () => {
    const result = applyFilters(sampleRows, { replaceCUPay: true })
    expect(result.find(r => r.entry_type === 'transaction-visa_card')).toBeUndefined()
    expect(result.find(r => r.entry_type === 'transaction-mastercard')).toBeUndefined()
    expect(result.find(r => r.description === 'credit card payment')).toBeUndefined()
  })

  it('replaceCUPay=false keeps non-CC rows', () => {
    const result = applyFilters(sampleRows, { replaceCUPay: false })
    expect(result.find(r => r.description === 'Monthly Salary')).toBeDefined()
  })
})
