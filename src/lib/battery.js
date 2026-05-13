import { supabase } from './supabase'

/**
 * Returns the most recent battery_history entries for a user.
 * Each row: { id, points (signed delta), reason, result, createdAt }
 */
export async function listBatteryHistory(userId, limit = 3) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('battery_history')
    .select('id, points, reason, result, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    points: r.points,
    reason: r.reason || 'Battery change',
    result: r.result,
    createdAt: r.created_at,
  }))
}

/** Friendly relative timestamp like "2h ago", "Yesterday", "3 days ago". */
export function relativeTime(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
