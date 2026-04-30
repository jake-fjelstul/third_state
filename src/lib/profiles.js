import { supabase } from './supabase'

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
  }
}

export async function listProfiles({ excludeUserId, limit = 50 } = {}) {
  let q = supabase
    .from('profiles')
    .select('id, name, age, city, bio, avatar_url, intents, interests')
    .limit(limit)
  if (excludeUserId) q = q.neq('id', excludeUserId)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(mapProfileRow)
}

export async function searchProfiles({ query, excludeUserId, limit = 20 }) {
  if (!query || !query.trim()) return []
  const term = `%${query.trim()}%`
  let q = supabase
    .from('profiles')
    .select('id, name, age, city, bio, avatar_url, intents, interests')
    .or(`name.ilike.${term},bio.ilike.${term}`)
    .limit(limit)
  if (excludeUserId) q = q.neq('id', excludeUserId)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(mapProfileRow)
}

export async function getProfileById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, age, city, bio, avatar_url, intents, interests')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return mapProfileRow(data)
}

export async function listProfilesByIds(ids) {
  const filtered = (ids || []).filter(Boolean)
  if (filtered.length === 0) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, age, city, bio, avatar_url, intents, interests')
    .in('id', filtered)
  if (error) throw error
  return (data || []).map(mapProfileRow)
}
