import { supabase } from './supabase'

function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Maps a row from `notifications` to the shape the UI expects.
 * The payload jsonb is unpacked into top-level fields so existing
 * Notifications.jsx code keeps working.
 */
export function mapNotificationRow(row) {
  if (!row) return null
  const payload = row.payload || {}
  return {
    id: row.id,
    type: row.type,
    isRead: !!row.is_read,
    timestamp: relativeTime(row.created_at),
    createdAt: row.created_at,
    // unpack payload fields onto the notification object
    user: payload.user || null,
    event: payload.event || null,
    circle: payload.circle || null,
    message: payload.message || '',
    targetId: payload.targetId || null,
    requestId: payload.requestId || null,
    suggestions: payload.suggestions || null,
    chatId: payload.chatId || null,
  }
}

export async function listNotifications(userId, { limit = 50 } = {}) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, payload, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(mapNotificationRow)
}

export async function markRead(notificationId) {
  if (!notificationId) return
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function markAllRead(userId) {
  if (!userId) return
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function deleteNotification(notificationId) {
  if (!notificationId) return
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
  if (error) throw error
}
