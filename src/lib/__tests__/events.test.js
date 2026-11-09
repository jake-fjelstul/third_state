import { describe, it, expect } from 'vitest'
import { normalizeTime, combineDateTimeToIso, toLocalDateString, toLocalTimeString } from '../events.js'

describe('normalizeTime', () => {
  it('keeps 24-hour values', () => {
    expect(normalizeTime('19:30')).toBe('19:30')
    expect(normalizeTime('7:05')).toBe('07:05')
  })
  it('converts legacy 12-hour labels (H1/M13)', () => {
    expect(normalizeTime('07:30 PM')).toBe('19:30')
    expect(normalizeTime('12:00 AM')).toBe('00:00')
    expect(normalizeTime('12:15 pm')).toBe('12:15')
  })
  it('rejects garbage', () => {
    expect(normalizeTime('25:00')).toBeNull()
    expect(normalizeTime('soon')).toBeNull()
    expect(normalizeTime('')).toBeNull()
  })
})

describe('event date/time round trip', () => {
  it('editing a 7:30 PM event keeps the same local day and time', () => {
    const iso = combineDateTimeToIso('2026-10-14', '19:30')
    const d = new Date(iso)
    // What mapEventRow seeds the edit form with:
    expect(toLocalDateString(d)).toBe('2026-10-14')
    expect(toLocalTimeString(d)).toBe('19:30')
    // Saving those values unchanged produces the same instant.
    expect(combineDateTimeToIso(toLocalDateString(d), toLocalTimeString(d))).toBe(iso)
  })
})

describe('expandRecurrence monthly (L2)', () => {
  it('clamps to month end without drifting', async () => {
    const { expandRecurrence } = await import('../events.js')
    const start = new Date(2027, 0, 31, 18, 0).toISOString()
    const days = expandRecurrence({ startsAt: start, rule: 'monthly', maxOccurrences: 4 })
      .map(iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}` })
    expect(days).toEqual(['1/31', '2/28', '3/31', '4/30'])
  })
})
