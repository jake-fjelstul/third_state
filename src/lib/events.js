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
    locationLat: row.location_lat ?? null,
    locationLng: row.location_lng ?? null,
    locationAddress: row.location_address ?? '',
    notes: row.notes || '',
    createdBy: row.created_by,
    attendeesCount: row.attendees_count ?? 0,
    attendedCount: row.attended_count ?? 0,
    coverImageUrl: row.cover_image_url || '',
    recurrenceRule: row.recurrence_rule || 'none',
    recurrenceEndDate: row.recurrence_end_date || null,
    recurrenceParentId: row.recurrence_parent_id || null,
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
      .select('user_id, profiles!user_id ( id, name, avatar_url )')
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
        id, circle_id, title, starts_at, location, location_lat, location_lng, location_address, notes, created_by, cover_image_url, recurrence_rule, recurrence_end_date, recurrence_parent_id,
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

export async function listPastEventsForUser(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('event_attendees')
    .select(`
      event_id,
      events:event_id (
        id, circle_id, title, starts_at, location, location_lat, location_lng, location_address, notes, created_by, cover_image_url, recurrence_rule, recurrence_end_date, recurrence_parent_id,
        circles(name)
      )
    `)
    .eq('user_id', userId)
  if (error) throw error
  const now = Date.now()
  const events = (data || [])
    .map(r => r.events)
    .filter(Boolean)
    .map(mapEventRow)
    .filter(e => e.dateObj && e.dateObj.getTime() < now)

  events.sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))
  return events
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

// ---------- recurrence helper ----------

export function expandRecurrence({ startsAt, rule, endDate, maxOccurrences = 26 }) {
  if (!startsAt || !rule || rule === 'none') {
    return startsAt ? [startsAt] : []
  }
  const cap = Math.min(maxOccurrences || 26, 26)
  const results = [startsAt]
  const endTs = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null

  let current = new Date(startsAt)

  while (results.length < cap) {
    const next = new Date(current)
    if (rule === 'weekly') {
      next.setDate(next.getDate() + 7)
    } else if (rule === 'biweekly') {
      next.setDate(next.getDate() + 14)
    } else if (rule === 'monthly') {
      next.setMonth(next.getMonth() + 1)
    } else {
      break
    }

    if (endTs && next.getTime() > endTs) {
      break
    }

    results.push(next.toISOString())
    current = next
  }

  return results
}

// ---------- writes ----------

function combineDateTimeToIso(date, time) {
  if (!date) return null
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '12:00'
  const local = new Date(`${date}T${t}:00`)
  if (Number.isNaN(local.getTime())) return null
  return local.toISOString()
}

export async function createEvent({
  userId,
  circleId,
  title,
  date,
  time,
  startsAt,
  location,
  locationLat,
  locationLng,
  locationAddress,
  notes,
  coverImageUrl,
  recurrenceRule,
  recurrenceEndDate,
}) {
  const iso = startsAt || combineDateTimeToIso(date, time)
  if (!iso) throw new Error('Event must have a valid date/time')

  const row = {
    circle_id: circleId,
    title,
    starts_at: iso,
    location: location || null,
    location_lat: locationLat ?? null,
    location_lng: locationLng ?? null,
    location_address: locationAddress || null,
    notes: notes || null,
    created_by: userId,
    cover_image_url: coverImageUrl || null,
    recurrence_rule: recurrenceRule || 'none',
    recurrence_end_date: recurrenceEndDate || null,
  }

  let res = await supabase.from('events').insert(row).select('*, circles(name)').single()
  
  if (res.error && res.error.code === 'PGRST204') {
    delete row.location_lat
    delete row.location_lng
    delete row.location_address
    delete row.cover_image_url
    delete row.recurrence_rule
    delete row.recurrence_end_date
    res = await supabase.from('events').insert(row).select('*, circles(name)').single()
  }

  if (res.error) throw res.error
  const parentData = res.data

  // Auto-RSVP creator to the parent only
  await supabase.from('event_attendees').insert({ event_id: parentData.id, user_id: userId })

  // Bulk-insert recurrence occurrences if rule is set and !== 'none'
  if (recurrenceRule && recurrenceRule !== 'none') {
    const occurrences = expandRecurrence({
      startsAt: iso,
      rule: recurrenceRule,
      endDate: recurrenceEndDate,
      maxOccurrences: 26,
    })

    const childTimes = occurrences.slice(1)
    if (childTimes.length > 0) {
      const childRows = childTimes.map(childIso => ({
        circle_id: circleId,
        title,
        starts_at: childIso,
        location: location || null,
        location_lat: locationLat ?? null,
        location_lng: locationLng ?? null,
        location_address: locationAddress || null,
        notes: notes || null,
        created_by: userId,
        cover_image_url: coverImageUrl || null,
        recurrence_rule: 'none',
        recurrence_end_date: null,
        recurrence_parent_id: parentData.id,
      }))
      const childRes = await supabase.from('events').insert(childRows)
      if (childRes.error) {
        console.warn('[createEvent] recurrence occurrences insert error', childRes.error)
      }
    }
  }

  return mapEventRow({ ...parentData, attendees_count: 1 })
}

export async function updateEvent({
  eventId,
  title,
  date,
  time,
  startsAt,
  location,
  locationLat,
  locationLng,
  locationAddress,
  notes,
  coverImageUrl,
}) {
  if (!eventId) throw new Error('Missing eventId')
  const patch = {}
  if (title !== undefined) patch.title = title
  if (date !== undefined || time !== undefined || startsAt !== undefined) {
    patch.starts_at = startsAt || combineDateTimeToIso(date, time)
  }
  if (location !== undefined) patch.location = location
  if (locationLat !== undefined) patch.location_lat = locationLat
  if (locationLng !== undefined) patch.location_lng = locationLng
  if (locationAddress !== undefined) patch.location_address = locationAddress
  if (notes !== undefined) patch.notes = notes
  if (coverImageUrl !== undefined) patch.cover_image_url = coverImageUrl
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select('*, circles(name)')
    .single()
  if (error) throw error

  return mapEventRow(data)
}

export async function deleteEvent(eventId) {
  if (!eventId) throw new Error('Missing eventId')
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export async function rsvp({ userId, eventId }) {
  const { error } = await supabase
    .from('event_attendees')
    .insert({ event_id: eventId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function cancelRsvp({ userId, eventId }) {
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function markAttendance({ eventId, userId, attended }) {
  if (!eventId || !userId) throw new Error('Missing eventId or userId')
  const { error } = await supabase.rpc('mark_event_attendance', {
    p_event_id: eventId,
    p_user_id: userId,
    p_attended: attended,
  })
  if (error) throw error
}

export async function listEventAttendeesWithStatus(eventId) {
  if (!eventId) return []
  const { data, error } = await supabase
    .from('event_attendees')
    .select('user_id, attended, checked_in_at, profiles!user_id (id, name, avatar_url)')
    .eq('event_id', eventId)
  if (error) throw error
  return (data || []).map(r => ({
    id: r.profiles?.id || r.user_id,
    name: r.profiles?.name || '',
    avatar: r.profiles?.avatar_url || '',
    attended: r.attended ?? null,
    checkedInAt: r.checked_in_at || null,
  }))
}
