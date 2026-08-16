import { supabase } from './supabase'

export async function listFriendGroups() {
  const { data, error } = await supabase.rpc('list_friend_groups')
  if (error) throw error
  const byId = new Map()
  for (const row of data || []) {
    if (!byId.has(row.group_id)) {
      byId.set(row.group_id, {
        id: row.group_id,
        name: row.name,
        createdAt: row.created_at,
        members: [],
      })
    }
    if (row.member_id) {
      byId.get(row.group_id).members.push({
        id: row.member_id,
        name: row.member_name || '',
        avatar: row.member_avatar_url || '',
      })
    }
  }
  return Array.from(byId.values())
}

/** Creates when groupId is null, otherwise renames and replaces membership. */
export async function saveFriendGroup({ name, memberIds, groupId = null }) {
  const { data, error } = await supabase.rpc('save_friend_group', {
    p_name: name,
    p_member_ids: memberIds || [],
    p_group_id: groupId,
  })
  if (error) throw error
  return data
}

export async function deleteFriendGroup(groupId) {
  const { error } = await supabase.from('friend_groups').delete().eq('id', groupId)
  if (error) throw error
}
