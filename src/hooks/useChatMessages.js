import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { listMessages } from '../lib/chat'

/**
 * Subscribes to new messages for a chat (optionally filtered to a channel).
 * Returns { messages, loading, error, append, refresh }.
 */
export function useChatMessages({ chatId, channelId = null } = {}) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const channelIdRef = useRef(channelId)
  channelIdRef.current = channelId

  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    listMessages(chatId, { channelId })
      .then(rows => {
        if (cancelled) return
        setMessages(rows)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })

    // Realtime: subscribe to inserts on this chat. Filter by channel client-side
    // so users get every message at the chat level (server-side filter doesn't
    // support compound filters cleanly here).
    const sub = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const row = payload.new
          if (!row) return
          if (channelIdRef.current && row.channel_id !== channelIdRef.current) return
          if (!channelIdRef.current && row.channel_id != null) return

          // Hydrate sender info (cheap: one row by id).
          let senderName = ''
          let senderAvatar = ''
          if (row.sender_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('id', row.sender_id)
              .maybeSingle()
            senderName = prof?.name || ''
            senderAvatar = prof?.avatar_url || ''
          }
          setMessages(prev => {
            // de-dupe in case of optimistic-then-realtime echo
            if (prev.some(m => m.id === row.id)) return prev
            return [...prev, {
              id: row.id,
              chatId: row.chat_id,
              channelId: row.channel_id,
              senderId: row.sender_id,
              senderName,
              senderAvatar,
              text: row.text,
              createdAt: row.created_at,
              time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(sub)
    }
  }, [chatId, channelId])

  const append = (msg) => {
    setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }
  const refresh = async () => {
    if (!chatId) return
    const rows = await listMessages(chatId, { channelId })
    setMessages(rows)
  }

  return { messages, loading, error, append, refresh }
}
