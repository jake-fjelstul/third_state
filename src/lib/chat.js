import { supabase } from './supabase'

// ---------- mappers ----------

export function mapMessageRow(row) {
  if (!row) return null
  return {
    id: row.id,
    chatId: row.chat_id,
    channelId: row.channel_id,
    senderId: row.sender_id,
    senderName: row.profiles?.name || row.sender_name || '',
    senderAvatar: row.profiles?.avatar_url || '',
    text: row.text,
    kind: row.kind || 'text',
    payload: row.payload || null,
    createdAt: row.created_at,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
  }
}

const MESSAGE_SELECT_FULL = 'id, chat_id, channel_id, sender_id, text, kind, payload, created_at, profiles:sender_id(id, name, avatar_url)'
const MESSAGE_SELECT_BASE = 'id, chat_id, channel_id, sender_id, text, created_at, profiles:sender_id(id, name, avatar_url)'

function isMissingGamesColumns(error) {
  const code = error?.code;
  if (code !== 'PGRST204' && code !== 'PGRST200' && code !== '42703') return false
  const message = String(error?.message || '')
  return message.includes('kind') || message.includes('payload')
}

function mapChatSummaryRow(row) {
  return {
    id: row.chat_id,
    type: row.chat_type,
    circleId: row.circle_id,
    name: row.name,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    time: row.last_message_at
      ? new Date(row.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    unread: row.unread_count,
    memberCount: row.member_count,
    avatar: row.avatar || '',
  }
}

// ---------- chats ----------

export async function listChats() {
  const { data, error } = await supabase.rpc('get_my_chat_summaries')
  if (error) throw error
  return (data || []).map(mapChatSummaryRow)
}

export async function getChat(chatId) {
  if (!chatId) return null
  const [chatRes, membersRes, channelsRes] = await Promise.all([
    supabase.from('chats').select('*, circles(name, emoji)').eq('id', chatId).maybeSingle(),
    supabase.from('chat_members').select('user_id, profiles(id, name, avatar_url)').eq('chat_id', chatId),
    supabase.from('chat_channels').select('*').eq('chat_id', chatId),
  ])
  if (chatRes.error) throw chatRes.error
  if (membersRes.error) throw membersRes.error
  if (channelsRes.error) throw channelsRes.error
  if (!chatRes.data) return null
  return {
    id: chatRes.data.id,
    type: chatRes.data.type,
    circleId: chatRes.data.circle_id,
    name: chatRes.data.name || chatRes.data.circles?.name || '',
    emoji: chatRes.data.circles?.emoji || '',
    members: (membersRes.data || []).map(r => ({
      id: r.profiles?.id,
      name: r.profiles?.name,
      avatar: r.profiles?.avatar_url || '',
    })),
    channels: (channelsRes.data || []).map(c => ({ id: c.id, name: c.name })),
  }
}

export async function listChannels(chatId) {
  if (!chatId) return []
  const { data, error } = await supabase
    .from('chat_channels')
    .select('id, name')
    .eq('chat_id', chatId)
    .order('name')
  if (error) throw error
  return data || []
}

export async function createChannel(chatId, name) {
  if (!chatId || !name?.trim()) return null
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  const { data, error } = await supabase
    .from('chat_channels')
    .insert({ chat_id: chatId, name: slug })
    .select('id, name')
    .single()
  if (error) throw error
  return data
}

// ---------- messages ----------

export async function listMessages(chatId, { channelId = null, limit = 100 } = {}) {
  if (!chatId) return []
  
  const buildQuery = (selectCols) => {
    let q = supabase
      .from('messages')
      .select(selectCols)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (channelId) q = q.eq('channel_id', channelId)
    else q = q.is('channel_id', null)
    return q
  }

  let data, error;
  try {
    const res = await buildQuery(MESSAGE_SELECT_FULL)
    data = res.data
    error = res.error
    if (error && isMissingGamesColumns(error)) throw error
  } catch (err) {
    if (isMissingGamesColumns(err)) {
      const res = await buildQuery(MESSAGE_SELECT_BASE)
      data = res.data
      error = res.error
    } else {
      error = err
    }
  }
  
  if (error) throw error
  return (data || []).map(mapMessageRow)
}

export async function sendMessage({ userId, chatId, channelId = null, text, kind = 'text', payload = null }) {
  if (!userId || !chatId || !text?.trim()) return null
  
  const insertPayload = {
    chat_id: chatId,
    channel_id: channelId,
    sender_id: userId,
    text: text.trim(),
  }
  if (kind !== 'text') {
    insertPayload.kind = kind
    insertPayload.payload = payload
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert(insertPayload)
      .select(MESSAGE_SELECT_FULL)
      .single()
      
    if (error && isMissingGamesColumns(error)) throw error
    if (error) throw error
    return mapMessageRow(data)
  } catch (err) {
    if (isMissingGamesColumns(err)) {
      delete insertPayload.kind
      delete insertPayload.payload
      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(MESSAGE_SELECT_BASE)
        .single()
      if (error) throw error
      return mapMessageRow(data)
    }
    throw err
  }
}

export async function markRead({ userId, chatId }) {
  if (!userId || !chatId) return
  const { error } = await supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', userId)
  if (error) throw error
}

// ---------- DM creation ----------

export async function findExistingDm(userIdA, userIdB) {
  // A DM is a chat of type 'dm' that has exactly these two members.
  // Find candidate chats where userIdA is a member and type='dm', then
  // check userIdB membership.
  const { data, error } = await supabase
    .from('chat_members')
    .select('chat_id, chats!inner(id, type)')
    .eq('user_id', userIdA)
    .eq('chats.type', 'dm')
  if (error) throw error
  const candidateIds = (data || []).map(r => r.chat_id)
  if (candidateIds.length === 0) return null

  const { data: peers, error: peerErr } = await supabase
    .from('chat_members')
    .select('chat_id')
    .in('chat_id', candidateIds)
    .eq('user_id', userIdB)
  if (peerErr) throw peerErr
  return peers?.[0]?.chat_id || null
}

export async function startDM({ userId, peerUserId }) {
  if (!userId || !peerUserId) throw new Error('startDM requires both user ids')
  if (userId === peerUserId) throw new Error('Cannot DM yourself')

  const { data, error } = await supabase.rpc('start_dm', { p_peer_id: peerUserId })
  if (error) throw error
  if (data) {
    try {
      await unhideChat(data)
    } catch (err) {
      console.error('[chat] unhideChat failed in startDM', err)
    }
  }
  return data
}

export async function hideChat(chatId) {
  const { error } = await supabase.rpc('hide_chat', { p_chat_id: chatId })
  if (error) throw error
}

export async function unhideChat(chatId) {
  const { error } = await supabase.rpc('unhide_chat', { p_chat_id: chatId })
  if (error) throw error
}

export async function updateMessagePayload(messageId, payload) {
  if (!messageId) return
  try {
    const { error } = await supabase.rpc('update_message_payload', {
      p_message_id: messageId,
      p_payload: payload,
    })
    if (!error) return
  } catch {
    // ignore RPC error and fallback
  }

  const { error } = await supabase
    .from('messages')
    .update({ payload })
    .eq('id', messageId)
  if (error) throw error
}

export async function toggleMessageReaction(messageId, emoji) {
  const { data, error } = await supabase.rpc('toggle_message_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  })
  if (error) throw error
  return data
}

export async function listChatReactions(chatId) {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji')
    .eq('chat_id', chatId)
  if (error) throw error
  return data || []
}


