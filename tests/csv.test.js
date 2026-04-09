import { describe, it, expect } from 'vitest'
import { parseCSV, detectDateColumn } from '../src/csv.js'

describe('parseCSV', () => {
  it('returns headers and rows from valid CSV', () => {
    const text = 'name,amount,date\nalice,100,2024-01-01\nbob,-50,2024-01-15'
    const { headers, rows } = parseCSV(text)
    expect(headers).toEqual(['name', 'amount', 'date'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ name: 'alice', amount: '100', date: '2024-01-01' })
    expect(rows[1]).toEqual({ name: 'bob', amount: '-50', date: '2024-01-15' })
  })

  it('trims whitespace from headers and values', () => {
    const text = ' name , amount \n alice , 100 '
    const { headers, rows } = parseCSV(text)
    expect(headers).toEqual(['name', 'amount'])
    expect(rows[0]).toEqual({ name: 'alice', amount: '100' })
  })

  it('skips blank lines', () => {
    const text = 'a,b\n1,2\n\n3,4\n'
    const { rows } = parseCSV(text)
    expect(rows).toHaveLength(2)
  })

  it('throws on text with fewer than 2 lines', () => {
    expect(() => parseCSV('just a header')).toThrow()
    expect(() => parseCSV('')).toThrow()
  })
})

describe('detectDateColumn', () => {
  it('prefers transaction_date when present', () => {
    expect(detectDateColumn(['statement_date', 'transaction_date', 'amount'])).toBe('transaction_date')
  })

  it('falls back to first column containing "date"', () => {
    expect(detectDateColumn(['amount', 'effective_date', 'description'])).toBe('effective_date')
  })

  it('falls back to first column when no date column found', () => {
    expect(detectDateColumn(['account', 'amount', 'category'])).toBe('account')
  })
})
