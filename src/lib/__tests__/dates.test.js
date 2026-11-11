import { describe, expect, it } from 'vitest'
import { parseLocalDate, expandRecurrence } from '../events.js'
import { startLabel, resolveWindow } from '../lfg.js'

describe('date fixes (plan Phase 4)', () => {
  it('parses YYYY-MM-DD as local midnight, not UTC', () => {
    const d = parseLocalDate('2026-11-12')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 12, 0])
    expect(parseLocalDate('nope')).toBeNull()
  })

  it('keeps the last weekly occurrence on the "repeat until" day (local evening)', () => {
    const start = new Date(2026, 10, 3, 20, 0) // Tue 8 PM local
    const list = expandRecurrence({ startsAt: start.toISOString(), rule: 'weekly', endDate: '2026-11-17' })
    const last = new Date(list[list.length - 1])
    expect(list).toHaveLength(3)
    expect([last.getMonth(), last.getDate(), last.getHours()]).toEqual([10, 17, 20])
  })

  it('labels a start time with its day when it is not today', () => {
    const now = new Date(2026, 10, 10, 15, 0)
    expect(startLabel(new Date(2026, 10, 10, 18, 0).toISOString(), now)).not.toMatch(/Tomorrow/)
    expect(startLabel(new Date(2026, 10, 11, 9, 0).toISOString(), now)).toMatch(/^Tomorrow /)
  })

  it('"this evening" after 11 PM still ends after it starts', () => {
    const { startsAt, expiresAt } = resolveWindow('evening', null, new Date(2026, 10, 10, 23, 30))
    expect(new Date(expiresAt) > new Date(startsAt)).toBe(true)
  })
})
