import { supabase } from './supabase.js'

export const LFG_WINDOWS = [
  { id: 'now',     label: 'Right now',    startOffsetMin: 0,   durationMin: 120 },
  { id: 'hour',    label: 'In 1hr',       startOffsetMin: 60,  durationMin: 120 },
  { id: 'evening', label: 'This evening', startOffsetMin: null, durationMin: null },
  { id: 'custom',  label: 'Custom',       startOffsetMin: null, durationMin: null },
]

/** Resolves a window id into concrete start/expiry timestamps. */
export function resolveWindow(windowId, customStartIso = null, now = new Date()) {
  if (windowId === 'evening') {
    const start = new Date(now)
    if (start.getHours() < 17) start.setHours(17, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 0, 0)
    return { startsAt: start.toISOString(), expiresAt: end.toISOString() }
  }
  if (windowId === 'custom') {
    const start = customStartIso ? new Date(customStartIso) : new Date(now.getTime() + 30 * 60000)
    const end = new Date(start.getTime() + 120 * 60000)
    return { startsAt: start.toISOString(), expiresAt: end.toISOString() }
  }
  const def = LFG_WINDOWS.find(w => w.id === windowId) || LFG_WINDOWS[0]
  const start = new Date(now.getTime() + (def.startOffsetMin || 0) * 60000)
  const end = new Date(start.getTime() + (def.durationMin || 120) * 60000)
  return { startsAt: start.toISOString(), expiresAt: end.toISOString() }
}

/**
 * Activity suggestions. `venueQuery` feeds searchVenues() so each activity can
 * recommend real nearby places. `hours` is the [startHour, endHour) range in
 * which the suggestion is offered.
 */
export const LFG_SUGGESTIONS = [
  { label: 'Grab coffee',      venueQuery: 'cafe',       hours: [6, 16] },
  { label: 'Get breakfast',    venueQuery: 'breakfast',  hours: [6, 11] },
  { label: 'Go for a run',     venueQuery: 'park',       hours: [5, 20] },
  { label: 'Shoot hoops',      venueQuery: 'basketball court', hours: [8, 21] },
  { label: 'Grab lunch',       venueQuery: 'restaurant', hours: [11, 15] },
  { label: 'Study together',   venueQuery: 'library',    hours: [8, 22] },
  { label: 'Hit the gym',      venueQuery: 'gym',        hours: [5, 22] },
  { label: 'Walk the trail',   venueQuery: 'trail',      hours: [6, 20] },
  { label: 'Grab dinner',      venueQuery: 'restaurant', hours: [16, 22] },
  { label: 'Get drinks',       venueQuery: 'bar',        hours: [16, 24] },
  { label: 'Catch a movie',    venueQuery: 'cinema',     hours: [12, 23] },
  { label: 'Board games',      venueQuery: 'board game cafe', hours: [12, 23] },
]

export function suggestionsForNow(now = new Date()) {
  const h = now.getHours()
  const inWindow = LFG_SUGGESTIONS.filter(s => h >= s.hours[0] && h < s.hours[1])
  return (inWindow.length >= 4 ? inWindow : LFG_SUGGESTIONS).slice(0, 6)
}

export async function createLfgPost({
  activity, startsAt, expiresAt, visibility = 'everyone',
  notifyConnections = false, place = null,
}) {
  const { data, error } = await supabase.rpc('create_lfg_post', {
    p_activity: activity,
    p_expires_at: expiresAt,
    p_visibility: visibility,
    p_notify_connections: notifyConnections,
    p_place_name: place?.name ?? null,
    p_place_address: place?.address ?? null,
    p_latitude: place?.lat ?? null,
    p_longitude: place?.lng ?? null,
    p_starts_at: startsAt,
  })
  if (error) throw error
  return data
}

function mapLfgRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    activity: row.activity,
    placeName: row.place_name,
    placeAddress: row.place_address,
    latitude: row.latitude,
    longitude: row.longitude,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    visibility: row.visibility,
    authorName: row.author?.name || '',
    authorAvatar: row.author?.avatar_url || '',
  }
}

export async function listActiveLfgPosts() {
  const { data, error } = await supabase
    .from('lfg_posts')
    .select('*, author:profiles!lfg_posts_user_id_fkey(id, name, avatar_url)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(mapLfgRow)
}

export async function listMyLfgPosts(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('lfg_posts')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapLfgRow)
}

export async function listJoinedLfgPosts(userId) {
  if (!userId) return []
  const { data: joins, error: jErr } = await supabase
    .from('lfg_joins')
    .select('post_id')
    .eq('user_id', userId)
  if (jErr) throw jErr
  const ids = (joins || []).map(j => j.post_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('lfg_posts')
    .select('*, author:profiles!lfg_posts_user_id_fkey(id, name, avatar_url)')
    .in('id', ids)
    .gt('expires_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapLfgRow)
}

export async function getLfgJoiners(postId) {
  const { data, error } = await supabase.rpc('lfg_post_joiners', { p_post_id: postId })
  if (error) throw error
  return (data || []).map(r => ({
    id: r.user_id,
    name: r.name,
    avatar: r.avatar_url,
    joinedAt: r.joined_at,
  }))
}

export async function leaveLfgPost(postId) {
  const { error } = await supabase.rpc('leave_lfg_post', { p_post_id: postId })
  if (error) throw error
  return true
}

export async function cancelLfgPost(postId) {
  const { error } = await supabase.from('lfg_posts').delete().eq('id', postId)
  if (error) throw error
  return true
}

export async function joinLfgPost(postId) {
  const { data, error } = await supabase.rpc('join_lfg_post', { p_post_id: postId })
  if (error) throw error
  return data
}

/** Human-readable countdown, e.g. "45m left" or "2h left". */
export function timeLeftLabel(expiresAt, now = new Date()) {
  const ms = new Date(expiresAt) - now
  if (ms <= 0) return 'Expired'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m left`
  return `${Math.round(mins / 60)}h left`
}

export async function getLfgJoinPreviews(postIds) {
  if (!postIds || postIds.length === 0) return {}
  const { data, error } = await supabase
    .from('lfg_joins')
    .select('post_id, user_id, profiles:user_id(id, name, avatar_url)')
    .in('post_id', postIds)
  if (error) return {}
  const byPost = {}
  for (const row of data || []) {
    if (!byPost[row.post_id]) byPost[row.post_id] = []
    byPost[row.post_id].push({
      id: row.user_id,
      name: row.profiles?.name || '',
      avatar: row.profiles?.avatar_url || '',
    })
  }
  return byPost
}
