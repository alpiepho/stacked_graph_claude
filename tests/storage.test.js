import { describe, it, expect, beforeEach } from 'vitest'
import { save, load, loadAll } from '../src/storage.js'

beforeEach(() => {
  localStorage.clear()
})

describe('save / load', () => {
  it('round-trips a string', () => {
    save('csv', 'hello,world\n1,2')
    expect(load('csv', '')).toBe('hello,world\n1,2')
  })

  it('round-trips an object', () => {
    const filters = { showAllCC: true, replaceCUPay: false, pickedCC: ['visa'] }
    save('filters', filters)
    expect(load('filters', null)).toEqual(filters)
  })

  it('round-trips an array', () => {
    save('hidden_series', ['visa', 'mastercard'])
    expect(load('hidden_series', [])).toEqual(['visa', 'mastercard'])
  })

  it('returns default when key is absent', () => {
    expect(load('missing_key', 'default')).toBe('default')
  })

  it('uses sg_ prefix so keys do not collide with unrelated storage', () => {
    save('csv', 'test')
    expect(localStorage.getItem('sg_csv')).not.toBeNull()
    expect(localStorage.getItem('csv')).toBeNull()
  })
})

describe('loadAll', () => {
  it('returns defaults when localStorage is empty', () => {
    const all = loadAll()
    expect(all.csv).toBe('')
    expect(all.dateCol).toBeNull()
    expect(all.stackCol).toBeNull()
    expect(all.filters.showAllCC).toBe(true)
    expect(all.filters.replaceCUPay).toBe(false)
    expect(all.filters.pickedCC).toEqual([])
    expect(all.hiddenSeries).toEqual([])
    expect(all.csvCollapsed).toBe(true)
  })

  it('returns saved values when present', () => {
    save('csv', 'a,b\n1,2')
    save('date_col', 'b')
    const all = loadAll()
    expect(all.csv).toBe('a,b\n1,2')
    expect(all.dateCol).toBe('b')
  })
})
