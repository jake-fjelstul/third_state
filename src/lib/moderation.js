import { supabase } from './supabase'

export const REPORT_REASONS = [
  { value: 'harassment',            label: 'Harassment or bullying' },
  { value: 'spam',                  label: 'Spam or scam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'impersonation',         label: 'Impersonation' },
  { value: 'safety_concern',        label: 'Safety concern' },
  { value: 'other',                 label: 'Something else' },
]

export async function blockUser(targetId) {
  if (!targetId) return
  const { error } = await supabase.rpc('block_user', { p_target_id: targetId })
  if (error) throw error
}

export async function unblockUser(targetId) {
  if (!targetId) return
  const { error } = await supabase.rpc('unblock_user', { p_target_id: targetId })
  if (error) throw error
}

export async function isBlockedWith(otherId) {
  if (!otherId) return false
  const { data, error } = await supabase.rpc('is_blocked_with', { p_other_id: otherId })
  if (error) return false
  return !!data
}

// Returns the set of user ids the current user cannot see, in either direction.
export async function listBlockedUserIds() {
  const { data, error } = await supabase.rpc('my_blocked_user_ids')
  if (error) return []
  // The RPC returns rows of uuid; normalize whichever shape comes back.
  return (data || []).map(r => (typeof r === 'string' ? r : r.my_blocked_user_ids)).filter(Boolean)
}

// Users the current user has explicitly blocked (for the Settings list).
export async function listMyBlocks() {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, profiles:blocked_id(id, name, avatar_url)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({
    id: row.blocked_id,
    name: row.profiles?.name || 'Unknown',
    avatar: row.profiles?.avatar_url || '',
    blockedAt: row.created_at,
  }))
}

export async function fileReport({
  reportedUserId = null,
  reportedMessageId = null,
  reportedCircleId = null,
  reason = 'other',
  details = null,
  context = null,
} = {}) {
  const { data, error } = await supabase.rpc('file_report', {
    p_reported_user_id: reportedUserId,
    p_reported_message_id: reportedMessageId,
    p_reported_circle_id: reportedCircleId,
    p_reason: reason,
    p_details: details,
    p_context: context,
  })
  if (error) throw error
  return data
}
