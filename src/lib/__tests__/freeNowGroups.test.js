import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase.js', () => ({ supabase: {} }))
vi.mock('../storage.js', () => ({ resizeImage: async (f) => f }))

const { groupFreeNow, placeKey, etaLabel } = await import('../lfg.js')

const post = (id, userId, place = null, spotId = null) => ({ id, userId, placeName: place, placeAddress: '', spotId })

describe('Free now grouping', () => {
  const clubmates = new Map([
    ['maya', new Set(['run-club'])],
    ['alex', new Set(['run-club', 'book-club'])],
    ['sam', new Set(['book-club'])],
  ])

  it('merges clubmates at the same spot', () => {
    const groups = groupFreeNow([post(1, 'maya', 'Blue Donkey'), post(2, 'alex', 'blue donkey ')], clubmates)
    expect(groups).toHaveLength(1)
    expect(groups[0].posts.map(p => p.id)).toEqual([1, 2])
  })

  it('keeps people apart when they share no circle of mine', () => {
    const groups = groupFreeNow([post(1, 'maya', 'Blue Donkey'), post(2, 'stranger', 'Blue Donkey')], clubmates)
    expect(groups).toHaveLength(2)
  })

  it('needs everyone in the group to share a circle', () => {
    // maya-alex share run club, alex-sam share book club, maya-sam share nothing
    const groups = groupFreeNow([post(1, 'maya', 'Park'), post(2, 'alex', 'Park'), post(3, 'sam', 'Park')], clubmates)
    expect(groups.map(g => g.posts.length)).toEqual([2, 1])
  })

  it('never merges posts without a place, and matches by spot first', () => {
    expect(groupFreeNow([post(1, 'maya'), post(2, 'alex')], clubmates)).toHaveLength(2)
    expect(placeKey(post(1, 'maya', 'A', 'spot-9'))).toBe('spot:spot-9')
    expect(groupFreeNow([post(1, 'maya', 'Cafe X', 's1'), post(2, 'alex', 'Different name', 's1')], clubmates)).toHaveLength(1)
  })

  it('merges me with clubmates at my spot', () => {
    const groups = groupFreeNow([post(0, 'me', 'Park'), post(1, 'maya', 'Park')], clubmates, 'me')
    expect(groups).toHaveLength(1)
  })

  it('shows minutes away only while someone is on the way', () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    expect(etaLabel({ etaAt: '2026-11-11T12:08:00Z' }, now)).toBe('~8 min away')
    expect(etaLabel({ etaAt: '2026-11-11T12:08:00Z', arrivedAt: 'x' }, now)).toBeNull()
    expect(etaLabel({ etaAt: '2026-11-11T11:58:00Z' }, now)).toBeNull()
  })
})
