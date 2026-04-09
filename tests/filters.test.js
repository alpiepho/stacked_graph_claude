import { describe, it, expect } from 'vitest'
import { isCCRow, isCUCCPayment, getCCAccounts, applyFilters } from '../src/filters.js'

const sampleRows = [
  { statement_type: 'checking', account: 'Salary',     description: 'Monthly Salary',       amount: '3500' },
  { statement_type: 'checking', account: 'CU Pay',     description: 'credit card payment',  amount: '-650' },
  { statement_type: 'credit_card', account: 'visa_card',   description: 'Whole Foods',      amount: '-200' },
  { statement_type: 'credit_card', account: 'visa_card',   description: 'Netflix',          amount: '-50'  },
  { statement_type: 'credit_card', account: 'mastercard',  description: 'Electric Bill',    amount: '-120' },
]

describe('isCCRow', () => {
  it('returns true for credit_card statement_type', () => {
    expect(isCCRow(sampleRows[2])).toBe(true)
  })
  it('returns false for checking', () => {
    expect(isCCRow(sampleRows[0])).toBe(false)
  })
})

describe('isCUCCPayment', () => {
  it('returns true when checking row description contains "credit card"', () => {
    expect(isCUCCPayment(sampleRows[1])).toBe(true)
  })
  it('returns false for income row', () => {
    expect(isCUCCPayment(sampleRows[0])).toBe(false)
  })
  it('returns false for a CC row (not a CU row)', () => {
    expect(isCUCCPayment(sampleRows[2])).toBe(false)
  })
})

describe('getCCAccounts', () => {
  it('returns unique CC account names', () => {
    const accounts = getCCAccounts(sampleRows)
    expect(accounts.sort()).toEqual(['mastercard', 'visa_card'])
  })
})

describe('applyFilters', () => {
  it('showAllCC=true keeps all CC rows as-is', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: [] })
    const ccRows = result.filter(r => r.statement_type === 'credit_card')
    expect(ccRows.map(r => r.account).includes('visa_card')).toBe(true)
    expect(ccRows.map(r => r.account).includes('mastercard')).toBe(true)
  })

  it('showAllCC=false merges all CC rows under "Credit Cards" account', () => {
    const result = applyFilters(sampleRows, { showAllCC: false, replaceCUPay: false, pickedCC: [] })
    const ccRows = result.filter(r => r.statement_type === 'credit_card')
    expect(ccRows.every(r => r.account === 'Credit Cards')).toBe(true)
  })

  it('replaceCUPay=true removes CU credit card payment rows', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: true, pickedCC: [] })
    const cuPayRow = result.find(r => r.description === 'credit card payment')
    expect(cuPayRow).toBeUndefined()
  })

  it('replaceCUPay=false keeps CU credit card payment rows', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: [] })
    const cuPayRow = result.find(r => r.description === 'credit card payment')
    expect(cuPayRow).toBeDefined()
  })

  it('pickedCC filters to only selected CC accounts (non-CC rows always included)', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: ['visa_card'] })
    const mcRow = result.find(r => r.account === 'mastercard')
    const visaRow = result.find(r => r.account === 'visa_card')
    const incomeRow = result.find(r => r.account === 'Salary')
    expect(mcRow).toBeUndefined()
    expect(visaRow).toBeDefined()
    expect(incomeRow).toBeDefined() // non-CC rows always pass through
  })

  it('pickedCC=[] includes all CC accounts', () => {
    const result = applyFilters(sampleRows, { showAllCC: true, replaceCUPay: false, pickedCC: [] })
    expect(result.find(r => r.account === 'mastercard')).toBeDefined()
  })
})
