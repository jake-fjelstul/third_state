import { supabase } from './supabase'

// ---------- mappers ----------

function mapEventRow(row) {
  if (!row) return null
  const dateObj = row.starts_at ? new Date(row.starts_at) : null
  const date = dateObj ? dateObj.toISOString().slice(0, 10) : ''
  const time = dateObj
    ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
  return {
    id: row.id,
    circleId: row.circle_id,
    circleName: row.circles?.name || row.circle_name || '',
    title: row.title,
    startsAt: row.starts_at,
    date,
    time,
    location: row.location || '',
    notes: row.notes || '',
    createdBy: row.created_by,
    attendeesCount: row.attendees_count ?? 0,
    attendees: row.attendees || [],
    dateObj,
  }
}

// ---------- reads ----------

export async function listUpcomingEvents({ limit = 50 } = {}) {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('events_with_counts')
    .select('*, circles(name)')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data || []).map(mapEventRow)
}

export async function listEventsForCircle(circleId, { upcomingOnly = true } = {}) {
  if (!circleId) return []
  let q = supabase
    .from('events_with_counts')
    .select('*, circles(name)')
    .eq('circle_id', circleId)
    .order('starts_at', { ascending: true })
  if (upcomingOnly) q = q.gte('starts_at', new Date().toISOString())
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(mapEventRow)
}

export async function getEvent(eventId) {
  if (!eventId) return null
  const [eventRes, attendeesRes] = await Promise.all([
    supabase
      .from('events_with_counts')
      .select('*, circles(name)')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('event_attendees')
      .select('user_id, profiles ( id, name, avatar_url )')
      .eq('event_id', eventId),
  ])
  if (eventRes.error) throw eventRes.error
  if (attendeesRes.error) throw attendeesRes.error
  if (!eventRes.data) return null

  const event = mapEventRow(eventRes.data)
  event.attendees = (attendeesRes.data || []).map(r => ({
    id: r.profiles?.id,
    name: r.profiles?.name,
    avatar: r.profiles?.avatar_url || '',
  }))
  return event
}

export async function listMyMeetups(userId, { upcomingOnly = false } = {}) {
  if (!userId) return []
  let q = supabase
    .from('event_attendees')
    .select(`
      event_id,
      events:event_id (
        id, circle_id, title, starts_at, location, notes, created_by,
        circles(name)
      )
    `)
    .eq('user_id', userId)
  const { data, error } = await q
  if (error) throw error
  let events = (data || [])
    .map(r => r.events)
    .filter(Boolean)
    .map(mapEventRow)
  if (upcomingOnly) {
    const now = Date.now()
    events = events.filter(e => e.dateObj && e.dateObj.getTime() >= now)
  }
  // sort ascending by starts_at
  events.sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0))
  return events
}

export async function listUpcomingEventsForUser(userId) {
  return listMyMeetups(userId, { upcomingOnly: true })
}

export async function listMyRsvpdEventIds(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map(r => r.event_id)
}

// ---------- writes ----------

function combineDateTimeToIso(date, time) {
  // date: 'YYYY-MM-DD', time: 'HH:MM' (24h) — assume local timezone of the user.
  if (!date) return null
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '12:00'
  const local = new Date(`${date}T${t}:00`)
  if (Number.isNaN(local.getTime())) return null
  return local.toISOString()
}

export async function createEvent({ userId, circleId, title, date, time, startsAt, location, notes }) {
  const iso = startsAt || combineDateTimeToIso(date, time)
  if (!iso) throw new Error('Event must have a valid date/time')
  const { data, error } = await supabase
    .from('events')
    .insert({
      circle_id: circleId,
      title,
      starts_at: iso,
      location: location || null,
      notes: notes || null,
      created_by: userId,
    })
    .select('*, circles(name)')
    .single()
  if (error) throw error
  // Auto-RSVP creator
  await supabase.from('event_attendees').insert({ event_id: data.id, user_id: userId })
  return mapEventRow({ ...data, attendees_count: 1 })
}

export async function rsvp({ userId, eventId }) {
  const { error } = await supabase
    .from('event_attendees')
    .insert({ event_id: eventId, user_id: userId })
  if (error && error.code !== '23505') throw error // ignore unique violation
}

export async function cancelRsvp({ userId, eventId }) {
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
  if (error) throw error
}
