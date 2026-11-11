import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }))

const { googleIdFor, isCopyOf } = await import('../calendar.js')

const EVENT = {
  id: '061666d0-1274-44c6-a573-675339823679',
  title: 'Sunset run',
  dateObj: new Date('2026-11-12T22:00:00Z'),
}

describe('add to calendar de-duplication', () => {
  it('maps an event to one fixed, valid Google id', () => {
    const gid = googleIdFor(EVENT)
    expect(gid).toBe('ts061666d0127444c6a573675339823679')
    expect(gid).toMatch(/^[0-9a-v]{5,1024}$/)
    expect(googleIdFor({ id: 'google-abc' })).toBeNull()
  })

  it('recognises our copy by id, by tag, and by the old title + time match', () => {
    expect(isCopyOf({ id: googleIdFor(EVENT) }, EVENT)).toBe(true)
    expect(isCopyOf({ id: 'x', extendedProperties: { private: { thirdSpaceEventId: EVENT.id } } }, EVENT)).toBe(true)
    const legacy = { id: 'random', summary: 'Sunset run', description: 'Third Space event · Run Club', start: { dateTime: '2026-11-12T22:00:00Z' } }
    expect(isCopyOf(legacy, EVENT)).toBe(true)
  })

  it("doesn't hide the person's own events", () => {
    expect(isCopyOf({ id: 'mine', summary: 'Sunset run', description: 'with Sam', start: { dateTime: '2026-11-12T22:00:00Z' } }, EVENT)).toBe(false)
    expect(isCopyOf({ id: 'other', summary: 'Sunset run', description: 'Third Space event', start: { dateTime: '2026-11-13T22:00:00Z' } }, EVENT)).toBe(false)
  })
})
