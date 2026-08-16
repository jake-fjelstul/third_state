import { supabase } from './supabase'
import { updateProfile } from './auth'

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
  }
}

const PROFILE_SELECT_WITH_LOCATION = 'id, name, age, city, bio, avatar_url, intents, intent_captured_at, intent_note, interests, latitude, longitude, privacy, notification_prefs'
const PROFILE_SELECT_BASE = 'id, name, age, city, bio, avatar_url, intents, intent_captured_at, intent_note, interests, privacy, notification_prefs'
const PROFILE_SELECT_NO_PRIVACY = 'id, name, age, city, bio, avatar_url, intents, intent_captured_at, intent_note, interests, notification_prefs'

function isMissingLocationColumn(error) {
  const code = error?.code;
  if (code !== 'PGRST204' && code !== 'PGRST200' && code !== '42703') return false
  const message = String(error?.message || '')
  return message.includes('latitude') || message.includes('longitude')
}

function isMissingPrivacyColumn(error) {
  const code = error?.code;
  if (code !== 'PGRST204' && code !== 'PGRST200' && code !== '42703') return false
  const message = String(error?.message || '')
  return message.includes('privacy')
}

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
    intentCapturedAt: row.intent_captured_at || null,
    intentNote: row.intent_note || '',
    interests: row.interests || [],
    latitude: row.latitude,
    longitude: row.longitude,
    privacy: row.privacy ?? defaultPrivacy(),
    notificationPrefs: row.notification_prefs ?? defaultNotificationPrefs(),
  }
}

async function runWithFallbacks(runQuery) {
  try {
    return await runQuery(PROFILE_SELECT_WITH_LOCATION)
  } catch (error) {
    if (isMissingPrivacyColumn(error)) {
      return await runQuery(PROFILE_SELECT_NO_PRIVACY)
    }
    if (!isMissingLocationColumn(error)) throw error
    
    try {
      return await runQuery(PROFILE_SELECT_BASE)
    } catch (err) {
      if (isMissingPrivacyColumn(err)) {
        return await runQuery(PROFILE_SELECT_NO_PRIVACY)
      }
      throw err
    }
  }
}

export async function listProfiles({ excludeUserId, limit = 50 } = {}) {
  return await runWithFallbacks(async (select) => {
    let q = supabase.from('profiles').select(select).limit(limit)
    if (excludeUserId) q = q.neq('id', excludeUserId)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(mapProfileRow)
  })
}

export async function searchProfiles({ query, excludeUserId, limit = 20 }) {
  if (!query || !query.trim()) return []
  const term = `%${query.trim()}%`
  return await runWithFallbacks(async (select) => {
    let q = supabase
      .from('profiles')
      .select(select)
      .or(`name.ilike.${term},bio.ilike.${term}`)
      .limit(limit)
    if (excludeUserId) q = q.neq('id', excludeUserId)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(mapProfileRow)
  })
}

export async function getProfileById(id) {
  if (!id) return null
  return await runWithFallbacks(async (select) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return mapProfileRow(data)
  })
}

export async function listProfilesByIds(ids) {
  const filtered = (ids || []).filter(Boolean)
  if (filtered.length === 0) return []
  return await runWithFallbacks(async (select) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .in('id', filtered)
    if (error) throw error
    return (data || []).map(mapProfileRow)
  })
}

export async function updatePrivacy(userId, patch) {
  const current = await getProfileById(userId)
  if (!current) throw new Error('Profile not found')
  const merged = { ...current.privacy, ...patch }
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
  const current = await getProfileById(userId)
  if (!current) throw new Error('Profile not found')
  const merged = { ...current.notificationPrefs, ...patch }
  await updateProfile(userId, { notification_prefs: merged })
}
