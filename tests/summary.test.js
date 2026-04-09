import { describe, it, expect } from 'vitest'
import { calcSummary } from '../src/summary.js'

const rows = [
  { transaction_date: '2024-01-01', amount: '3500' },
  { transaction_date: '2024-01-05', amount: '-1200' },
  { transaction_date: '2024-01-10', amount: '-300' },
  { transaction_date: '2024-02-01', amount: '3500' },
  { transaction_date: '2024-02-08', amount: '-1200' },
  { transaction_date: '2024-02-15', amount: '-500' },
]

describe('calcSummary', () => {
  it('sums positive amounts as income', () => {
    const { income } = calcSummary(rows, 'transaction_date')
    expect(income.total).toBeCloseTo(7000)
  })

  it('sums negative amounts as expenses (positive value)', () => {
    const { expenses } = calcSummary(rows, 'transaction_date')
    expect(expenses.total).toBeCloseTo(3200)
  })

  it('net = income total - expenses total', () => {
    const { net } = calcSummary(rows, 'transaction_date')
    expect(net.total).toBeCloseTo(3800)
  })

  it('monthly = total / number of unique months', () => {
    const { income, expenses, net } = calcSummary(rows, 'transaction_date')
    expect(income.monthly).toBeCloseTo(3500)   // 7000 / 2
    expect(expenses.monthly).toBeCloseTo(1600) // 3200 / 2
    expect(net.monthly).toBeCloseTo(1900)      // 3800 / 2
  })

  it('handles single month', () => {
    const single = [
      { transaction_date: '2024-01-01', amount: '1000' },
      { transaction_date: '2024-01-15', amount: '-400' },
    ]
    const { income, expenses, net } = calcSummary(single, 'transaction_date')
    expect(income.total).toBeCloseTo(1000)
    expect(expenses.total).toBeCloseTo(400)
    expect(net.monthly).toBeCloseTo(600)
  })
})
