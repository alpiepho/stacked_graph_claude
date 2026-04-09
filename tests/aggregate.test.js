import { describe, it, expect } from 'vitest'
import { aggregate } from '../src/aggregate.js'

const rows = [
  { date: '2024-01-05', account: 'visa',   amount: '-100' },
  { date: '2024-01-20', account: 'checking', amount: '3500' },
  { date: '2024-02-05', account: 'visa',   amount: '-200' },
  { date: '2024-02-10', account: 'checking', amount: '3500' },
  { date: '2024-02-15', account: 'visa',   amount: '-50' },
]

describe('aggregate', () => {
  it('returns sorted unique months', () => {
    const { months } = aggregate(rows, 'date', 'account')
    expect(months).toEqual(['2024-01', '2024-02'])
  })

  it('returns one series per unique stack value', () => {
    const { series } = aggregate(rows, 'date', 'account')
    expect(series.map(s => s.label).sort()).toEqual(['checking', 'visa'])
  })

  it('sums amounts per series per month', () => {
    const { months, series } = aggregate(rows, 'date', 'account')
    const visa = series.find(s => s.label === 'visa')
    const checking = series.find(s => s.label === 'checking')
    expect(visa.data).toEqual([-100, -250]) // Jan: -100, Feb: -200 + -50
    expect(checking.data).toEqual([3500, 3500])
  })

  it('fills zero for months where a series has no data', () => {
    const sparse = [
      { date: '2024-01-01', account: 'a', amount: '100' },
      { date: '2024-02-01', account: 'b', amount: '200' },
    ]
    const { series } = aggregate(sparse, 'date', 'account')
    const a = series.find(s => s.label === 'a')
    const b = series.find(s => s.label === 'b')
    expect(a.data).toEqual([100, 0])
    expect(b.data).toEqual([0, 200])
  })

  it('skips rows with missing date or stack column', () => {
    const dirty = [
      { date: '', account: 'visa', amount: '-50' },
      { date: '2024-01-01', account: '', amount: '-50' },
      { date: '2024-01-01', account: 'visa', amount: '-100' },
    ]
    const { series } = aggregate(dirty, 'date', 'account')
    const visa = series.find(s => s.label === 'visa')
    expect(visa.data).toEqual([-100])
  })
})
