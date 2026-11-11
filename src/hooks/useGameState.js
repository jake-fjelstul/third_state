import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchGame } from '../lib/games'
import { uniqueTopic } from '../lib/realtimeTopic.js'

export function useGameState(gameId) {
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!gameId) { setGame(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetchGame(gameId)
      .then(g => { if (!cancelled) { setGame(g); setError(null) } })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })

    const sub = supabase
      .channel(uniqueTopic(`game:${gameId}`))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        async () => {
          // Refetch to get joined profile rows
          const fresh = await fetchGame(gameId)
          if (!cancelled) setGame(fresh)
        })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(sub) }
  }, [gameId])

  // Apply a game row we already have (the move response) without waiting for
  // realtime. Rows from the edge function lack the joined profiles, so keep
  // the names and avatars we already know.
  const applyGame = useCallback((fresh) => {
    if (!fresh) return
    setGame(prev => prev ? {
      ...fresh,
      playerX: { ...prev.playerX, ...(fresh.playerX?.name ? fresh.playerX : {}) },
      playerO: { ...prev.playerO, ...(fresh.playerO?.name ? fresh.playerO : {}) },
    } : fresh)
  }, [])

  const reload = useCallback(async () => {
    if (!gameId) return
    try { setGame(await fetchGame(gameId)) } catch (err) { console.error('[useGameState] reload failed', err) }
  }, [gameId])

  return { game, loading, error, applyGame, reload }
}
