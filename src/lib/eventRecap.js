import { supabase } from './supabase'
import { resizeImage } from './storage'

function mapPhotoRow(row) {
  if (!row) return null
  return {
    id: row.id,
    url: row.url,
    storagePath: row.storage_path,
    caption: row.caption || '',
    createdAt: row.created_at,
    user: {
      id: row.profiles?.id || row.user_id,
      name: row.profiles?.name || '',
      avatar: row.profiles?.avatar_url || '',
    },
  }
}

function mapReactionRow(row) {
  if (!row) return null
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    targetUserId: row.target_user_id || null,
    emoji: row.emoji,
    note: row.note || '',
    createdAt: row.created_at,
    user: {
      id: row.profiles?.id || row.user_id,
      name: row.profiles?.name || '',
      avatar: row.profiles?.avatar_url || '',
    },
  }
}

export async function listEventPhotos(eventId) {
  if (!eventId) return []
  const { data, error } = await supabase
    .from('event_photos')
    .select('id, url, storage_path, caption, created_at, user_id, profiles ( id, name, avatar_url )')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapPhotoRow)
}

export async function uploadEventPhoto({ eventId, userId, file }) {
  if (!eventId || !userId || !file) throw new Error('Missing arguments for uploadEventPhoto')

  const blob = await resizeImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 })
  const filename = `${crypto.randomUUID()}.jpg`
  const path = `${eventId}/${userId}/${filename}`

  const { error: storageErr } = await supabase.storage
    .from('event-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (storageErr) throw storageErr

  const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const { data: dbData, error: dbErr } = await supabase
    .from('event_photos')
    .insert({
      event_id: eventId,
      user_id: userId,
      url: publicUrl,
      storage_path: path,
    })
    .select('id, url, storage_path, caption, created_at, user_id, profiles ( id, name, avatar_url )')
    .single()

  if (dbErr) throw dbErr
  return mapPhotoRow(dbData)
}

export async function deleteEventPhoto({ photoId, storagePath }) {
  if (!photoId) return
  if (storagePath) {
    await supabase.storage.from('event-photos').remove([storagePath]).catch(() => {})
  }
  const { error } = await supabase.from('event_photos').delete().eq('id', photoId)
  if (error) throw error
}

export async function listEventReactions(eventId) {
  if (!eventId) return []
  const { data, error } = await supabase
    .from('event_reactions')
    .select('id, event_id, user_id, target_user_id, emoji, note, created_at, profiles:user_id ( id, name, avatar_url )')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapReactionRow)
}

export async function addEventReaction({ eventId, userId, targetUserId, emoji, note }) {
  if (!eventId || !userId || !emoji) throw new Error('Missing required arguments for addEventReaction')

  const { data, error } = await supabase
    .from('event_reactions')
    .insert({
      event_id: eventId,
      user_id: userId,
      target_user_id: targetUserId || null,
      emoji,
      note: note || null,
    })
    .select('id, event_id, user_id, target_user_id, emoji, note, created_at, profiles:user_id ( id, name, avatar_url )')
    .single()

  if (error) throw error

  // Notify recipient if targetUserId is set and not self
  if (targetUserId && targetUserId !== userId) {
    try {
      const senderName = data.profiles?.name || 'Someone'
      await supabase.rpc('enqueue_notification', {
        p_user_id: targetUserId,
        p_type: 'circle_activity',
        p_payload: {
          message: `${senderName} reacted ${emoji} to your event presence!`,
          eventId,
          senderId: userId,
          emoji,
        },
      })
    } catch (notifErr) {
      console.warn('[addEventReaction] notification failed', notifErr)
    }
  }

  return mapReactionRow(data)
}

export async function removeEventReaction(reactionId) {
  if (!reactionId) return
  const { error } = await supabase.from('event_reactions').delete().eq('id', reactionId)
  if (error) throw error
}
