import { supabase } from './supabase'

/**
 * Returns busy blocks (events the user is attending) within [fromIso, toIso].
 * Joins event_attendees → events.
 * Caller is responsible for connection + privacy gating.
 */
export async function getAvailabilityForUser(userId, { fromIso, toIso }) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('event_attendees')
    .select('events!inner(id, title, starts_at, location)')
    .eq('user_id', userId)
    .gte('events.starts_at', fromIso)
    .lte('events.starts_at', toIso)
    .order('starts_at', { foreignTable: 'events', ascending: true })
  if (error) throw error
  return (data || []).map(row => ({
    id:        row.events.id,
    title:     row.events.title,
    startsAt:  row.events.starts_at,
    // events table has no duration column — assume 90 min default.
    endsAt:    new Date(new Date(row.events.starts_at).getTime() + 90 * 60 * 1000).toISOString(),
    location:  row.events.location,
  }))
}

/**
 * Checks whether `at` (ISO timestamp) overlaps any of the user's busy blocks
 * in the next 14 days (or +/- 24h as designed). Returns the conflicting block or null.
 */
export async function checkConflictAt(userId, atIso) {
  const at = new Date(atIso)
  const from = new Date(at.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const to   = new Date(at.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const busy = await getAvailabilityForUser(userId, { fromIso: from, toIso: to })
  return busy.find(b => at >= new Date(b.startsAt) && at < new Date(b.endsAt)) || null
}

export const AVAILABILITY_START_HOUR = 9   // 9:00 AM
export const AVAILABILITY_END_HOUR   = 21  // 9:00 PM

/**
 * Given a calendar day and the busy blocks that overlap it, return the free
 * intervals inside [AVAILABILITY_START_HOUR, AVAILABILITY_END_HOUR] in the
 * viewer's local time.
 *
 * @param {Date} day        - any time on the target day; only Y/M/D used
 * @param {Array} busyBlocks - [{ startsAt, endsAt, title }] from getAvailabilityForUser
 * @returns {Array} [{ startsAt: ISO, endsAt: ISO }]
 */
export function computeFreeSlots(day, busyBlocks) {
  const dayStart = new Date(day)
  dayStart.setHours(AVAILABILITY_START_HOUR, 0, 0, 0)
  const dayEnd = new Date(day)
  dayEnd.setHours(AVAILABILITY_END_HOUR, 0, 0, 0)

  // Clip & filter busy blocks to within today's window
  const clipped = (busyBlocks || [])
    .map(b => ({ start: new Date(b.startsAt), end: new Date(b.endsAt) }))
    .filter(b => b.end > dayStart && b.start < dayEnd)
    .map(b => ({
      start: b.start < dayStart ? dayStart : b.start,
      end:   b.end   > dayEnd   ? dayEnd   : b.end,
    }))
    .sort((a, b) => a.start - b.start)

  // Merge overlapping busy blocks
  const merged = []
  for (const b of clipped) {
    const last = merged[merged.length - 1]
    if (last && b.start <= last.end) {
      last.end = b.end > last.end ? b.end : last.end
    } else {
      merged.push({ ...b })
    }
  }

  // If "today", start cursor at max(dayStart, ceil(now to next 15 min)).
  // This avoids suggesting past times.
  const now = new Date()
  const isToday =
    dayStart.getFullYear() === now.getFullYear() &&
    dayStart.getMonth()    === now.getMonth() &&
    dayStart.getDate()     === now.getDate()
  let cursor = dayStart
  if (isToday && now > cursor) {
    const rounded = new Date(now)
    rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15, 0, 0)
    cursor = rounded > cursor ? rounded : cursor
  }
  if (cursor >= dayEnd) return []

  // Invert: free = window minus merged busy
  const free = []
  for (const b of merged) {
    if (cursor < b.start) {
      free.push({ startsAt: cursor.toISOString(), endsAt: b.start.toISOString() })
    }
    cursor = b.end > cursor ? b.end : cursor
  }
  if (cursor < dayEnd) {
    free.push({ startsAt: cursor.toISOString(), endsAt: dayEnd.toISOString() })
  }
  // Drop slots shorter than 30 min — not useful as suggestions
  return free.filter(s => new Date(s.endsAt) - new Date(s.startsAt) >= 30 * 60 * 1000)
}
