import { supabase } from './supabase'

export async function createChatGame({ chatId, gameType }) {
  const { data, error } = await supabase.rpc('create_chat_game', {
    p_chat_id: chatId, p_game_type: gameType,
  })
  if (error) throw error
  return data  // gameId
}

export async function fetchGame(gameId) {
  if (!gameId) return null
  const { data, error } = await supabase
    .from('games')
    .select('*, player_x_profile:player_x(id,name,avatar_url), player_o_profile:player_o(id,name,avatar_url)')
    .eq('id', gameId)
    .maybeSingle()
  if (error) throw error
  return data ? mapGameRow(data) : null
}

/**
 * Send a move to the game-move edge function, which validates it with the
 * shared rules and computes the winner server-side. `move` is the same
 * argument the board passes to applyMove (cell index, column, or
 * { from, to, ... }).
 */
export async function commitGameMove({ gameId, move }) {
  const { data, error } = await supabase.functions.invoke('game-move', {
    body: { gameId, move },
  })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch { /* keep generic message */ }
    throw new Error(message)
  }
  return data?.game ? mapGameRow(data.game) : null
}

export async function resignGame(gameId) {
  const { data, error } = await supabase.rpc('resign_game', { p_game_id: gameId })
  if (error) throw error
  return data ? mapGameRow(data) : null
}

export function mapGameRow(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    chatId: row.chat_id,
    playerX: { id: row.player_x, name: row.player_x_profile?.name || '', avatar: row.player_x_profile?.avatar_url || '' },
    playerO: { id: row.player_o, name: row.player_o_profile?.name || '', avatar: row.player_o_profile?.avatar_url || '' },
    currentTurn: row.current_turn,
    state: row.state,
    status: row.status,
    winner: row.winner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
