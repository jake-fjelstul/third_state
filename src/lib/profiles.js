import { supabase } from './supabase'

const PROFILE_SELECT_WITH_LOCATION = 'id, name, age, city, bio, avatar_url, intents, interests, latitude, longitude'
const PROFILE_SELECT_BASE = 'id, name, age, city, bio, avatar_url, intents, interests'

function isMissingLocationColumn(error) {
  if (error?.code !== 'PGRST204') return false
  const message = String(error?.message || '')
  return message.includes("'latitude'") || message.includes("'longitude'")
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
    interests: row.interests || [],
    latitude: row.latitude,
    longitude: row.longitude,
  }
}

export async function listProfiles({ excludeUserId, limit = 50 } = {}) {
  const run = async (select) => {
    let q = supabase.from('profiles').select(select).limit(limit)
    if (excludeUserId) q = q.neq('id', excludeUserId)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(mapProfileRow)
  }
  try {
    return await run(PROFILE_SELECT_WITH_LOCATION)
  } catch (error) {
    if (!isMissingLocationColumn(error)) throw error
    return await run(PROFILE_SELECT_BASE)
  }
}

export async function searchProfiles({ query, excludeUserId, limit = 20 }) {
  if (!query || !query.trim()) return []
  const term = `%${query.trim()}%`
  const run = async (select) => {
    let q = supabase
      .from('profiles')
      .select(select)
      .or(`name.ilike.${term},bio.ilike.${term}`)
      .limit(limit)
    if (excludeUserId) q = q.neq('id', excludeUserId)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(mapProfileRow)
  }
  try {
    return await run(PROFILE_SELECT_WITH_LOCATION)
  } catch (error) {
    if (!isMissingLocationColumn(error)) throw error
    return await run(PROFILE_SELECT_BASE)
  }
}

export async function getProfileById(id) {
  if (!id) return null
  const run = async (select) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return mapProfileRow(data)
  }
  try {
    return await run(PROFILE_SELECT_WITH_LOCATION)
  } catch (error) {
    if (!isMissingLocationColumn(error)) throw error
    return await run(PROFILE_SELECT_BASE)
  }
}

export async function listProfilesByIds(ids) {
  const filtered = (ids || []).filter(Boolean)
  if (filtered.length === 0) return []
  const run = async (select) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .in('id', filtered)
    if (error) throw error
    return (data || []).map(mapProfileRow)
  }
  try {
    return await run(PROFILE_SELECT_WITH_LOCATION)
  } catch (error) {
    if (!isMissingLocationColumn(error)) throw error
    return await run(PROFILE_SELECT_BASE)
  }
}
