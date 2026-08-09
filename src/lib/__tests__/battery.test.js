import { describe, it, expect, vi } from 'vitest'
import { relativeTime } from '../battery.js'

describe('battery library', () => {
  describe('relativeTime', () => {
    it('returns empty string for null/undefined input', () => {
      expect(relativeTime(null)).toBe('')
      expect(relativeTime(undefined)).toBe('')
    })

    it('returns "Just now" for current time', () => {
      const now = new Date().toISOString()
      expect(relativeTime(now)).toBe('Just now')
    })

    it('returns minute diff for recent times', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(relativeTime(fiveMinsAgo)).toBe('5m ago')
    })

    it('returns hour diff for times earlier today', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(threeHoursAgo)).toBe('3h ago')
    })

    it('returns "Yesterday" for 24h ago', () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(yesterday)).toBe('Yesterday')
    })

    it('returns days ago for times within the week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(threeDaysAgo)).toBe('3 days ago')
    })

    it('returns weeks ago for times past 7 days', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(twoWeeksAgo)).toBe('2w ago')
    })
  })
})
