import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPoll } from '../lib/polls'

export function usePoll(pollId) {
  const [poll, setPoll] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!pollId) return null
    const fresh = await fetchPoll(pollId)
    setPoll(fresh)
    return fresh
  }, [pollId])

  useEffect(() => {
    if (!pollId) { setPoll(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)

    fetchPoll(pollId)
      .then(p => { if (!cancelled) { setPoll(p); setError(null) } })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })

    const refresh = async () => {
      try {
        const fresh = await fetchPoll(pollId)
        if (!cancelled) setPoll(fresh)
      } catch (err) {
        console.error('[usePoll] refresh failed', err)
      }
    }

    const sub = supabase
      .channel(`poll:${pollId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` },
        refresh)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls', filter: `id=eq.${pollId}` },
        refresh)
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(sub) }
  }, [pollId])

  return { poll, loading, error, reload }
}
