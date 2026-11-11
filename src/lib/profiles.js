import { supabase } from './supabase'
import { updateProfile, getProfile as getMyProfileRow } from './auth'

export function defaultPrivacy() {
  return {
    isPrivateProfile: false,
    showBio: true,
    showInterests: true,
    showCircles: true,
    showLocation: true,
    showAvailability: true
  }
}

export function defaultNotificationPrefs() {
  return {
    connections: true,
    events: true,
    reconnect_nudges: true,
    chat_activity: true,
    messages: true,
    daily_question: true,
    free_now: true,
  }
}

// Other people's profiles. public_profiles applies their privacy settings
// server-side and rounds location to ~1 km (audit M8).
const PUBLIC_PROFILE_SELECT = 'id, name, age, city, bio, avatar_url, intents, interests, latitude, longitude, privacy, created_at'

function mapProfileRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    city: row.city,
    bio: row.bio,
    avatar: row.avatar_url || '',
    intents: row.intents || [],
    interests: row.interests || [],
    latitude: row.latitude,
    longitude: row.longitude,
    privacy: row.privacy ?? defaultPrivacy(),
  }
}

/** People to discover, nearest first, searched on the server (audit M3). */
export async function listProfiles({ excludeUserId, limit = 60, query = null } = {}) {
  const { data, error } = await supabase.rpc('discover_people', { p_query: query, p_limit: limit })
  if (error) throw error
  return (data || []).filter(r => r.id !== excludeUserId).map(mapProfileRow)
}

export async function searchProfiles({ query, excludeUserId, limit = 20 }) {
  if (!query || !query.trim()) return []
  return listProfiles({ excludeUserId, limit, query: query.trim() })
}

export async function getProfileById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('public_profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return mapProfileRow(data)
}

export async function listProfilesByIds(ids) {
  const filtered = (ids || []).filter(Boolean)
  if (filtered.length === 0) return []
  const { data, error } = await supabase
    .from('public_profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .in('id', filtered)
  if (error) throw error
  return (data || []).map(mapProfileRow)
}

/** Everyone who shares a circle with me (New Message, audit M11). */
export async function listCircleMates() {
  const { data, error } = await supabase.rpc('my_circle_mates')
  if (error) throw error
  return (data || []).map(r => ({ id: r.id, name: r.name, avatar: r.avatar_url || '' }))
}

// Both read your own full row: public_profiles has no notification_prefs.
export async function updatePrivacy(userId, patch) {
  const current = await getMyProfileRow(userId)
  if (!current) throw new Error('Profile not found')
  const merged = { ...(current.privacy ?? defaultPrivacy()), ...patch }
  await updateProfile(userId, { privacy: merged })
}

export async function saveIntents(userId, { intents, note }) {
  await updateProfile(userId, {
    intents,
    intent_note: note,
    intent_captured_at: new Date().toISOString()
  })
}

export async function updateNotificationPrefs(userId, patch) {
  const current = await getMyProfileRow(userId)
  if (!current) throw new Error('Profile not found')
  const merged = { ...defaultNotificationPrefs(), ...(current.notification_prefs || {}), ...patch }
  await updateProfile(userId, { notification_prefs: merged })
}
