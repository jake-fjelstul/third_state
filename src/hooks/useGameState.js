import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchGame } from '../lib/games'

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
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        async () => {
          // Refetch to get joined profile rows
          const fresh = await fetchGame(gameId)
          if (!cancelled) setGame(fresh)
        })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(sub) }
  }, [gameId])

  return { game, loading, error }
}
