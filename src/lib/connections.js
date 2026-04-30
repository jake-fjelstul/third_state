import { supabase } from './supabase'

function mapConnectionRow(row) {
  const p = row.profiles || {}
  return {
    id: row.connected_user_id,
    name: p.name,
    avatar: p.avatar_url || '',
    bio: p.bio,
    age: p.age,
    city: p.city,
    interests: p.interests || [],
    lastHangout: row.last_hangout,
    connectedAt: row.created_at,
  }
}

export async function listMyConnections(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('connections')
    .select('connected_user_id, last_hangout, created_at, profiles:connected_user_id(id, name, avatar_url, bio, age, city, interests)')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map(mapConnectionRow)
}

export async function addConnection({ userId, connectedUserId }) {
  const { error } = await supabase
    .from('connections')
    .insert({ user_id: userId, connected_user_id: connectedUserId })
  if (error && error.code !== '23505') throw error // ignore unique-violation
}

export async function removeConnection({ userId, connectedUserId }) {
  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('user_id', userId)
    .eq('connected_user_id', connectedUserId)
  if (error) throw error
}

export async function updateLastHangout({ userId, connectedUserId, when }) {
  const { error } = await supabase
    .from('connections')
    .update({ last_hangout: when || new Date().toISOString() })
    .eq('user_id', userId)
    .eq('connected_user_id', connectedUserId)
  if (error) throw error
}

// ---------- Connection Requests ----------

export async function sendConnectionRequest({ requesterId, recipientId }) {
  if (!requesterId || !recipientId || requesterId === recipientId) return null
  const { data, error } = await supabase
    .from('connection_requests')
    .upsert(
      { requester_id: requesterId, recipient_id: recipientId, status: 'pending' },
      { onConflict: 'requester_id,recipient_id', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function acceptConnectionRequest(requestId) {
  if (!requestId) return
  const { error } = await supabase
    .from('connection_requests')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
  // The DB trigger materializes the connection rows on accept.
}

export async function declineConnectionRequest(requestId) {
  if (!requestId) return
  const { error } = await supabase
    .from('connection_requests')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
}
