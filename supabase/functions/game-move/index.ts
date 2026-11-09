// game-move: the only write path for in-progress games (audit C8).
//
// The client sends the move it wants to make, not the resulting board. This
// function replays it with the same rules module the app uses
// (../_shared/games), computes the winner itself, and writes the result with
// the service role. Direct UPDATEs on public.games are revoked in 067.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as ttt from '../_shared/games/ticTacToe.js'
import * as c4 from '../_shared/games/connectFour.js'
import * as checkers from '../_shared/games/checkers.js'
import * as chess from '../_shared/games/chess.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// deno-lint-ignore no-explicit-any
const MODULES: Record<string, any> = {
  tic_tac_toe: ttt,
  connect_four: c4,
  checkers,
  chess,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  const uid = userData?.user?.id
  if (userErr || !uid) return json({ error: 'Not authenticated' }, 401)

  let body: { gameId?: string; move?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { gameId, move } = body
  if (!gameId || move === undefined || move === null) return json({ error: 'Missing gameId or move' }, 400)

  const { data: game, error: gameErr } = await admin.from('games').select('*').eq('id', gameId).maybeSingle()
  if (gameErr) return json({ error: gameErr.message }, 500)
  if (!game) return json({ error: 'Game not found' }, 404)
  if (game.status !== 'in_progress') return json({ error: 'Game already ended' }, 409)

  const myToken = game.player_x === uid ? 'x' : game.player_o === uid ? 'o' : null
  if (!myToken) return json({ error: 'You are not a player in this game' }, 403)
  if (game.current_turn !== myToken) return json({ error: 'Not your turn' }, 409)

  const mod = MODULES[game.type]
  if (!mod) return json({ error: `Unknown game type ${game.type}` }, 400)

  let next
  try { next = mod.applyMove(game.state, move, myToken) } catch { next = null }
  if (!next) return json({ error: 'Illegal move' }, 400)

  const opp = myToken === 'x' ? 'o' : 'x'
  let winner: string | null = mod.winner(next)
  if (!winner && game.type === 'checkers' && checkers.noMovesFor(next, opp)) winner = myToken

  // Optimistic concurrency: only write if nobody moved since we read.
  const { data: updated, error: updErr } = await admin
    .from('games')
    .update({
      state: next,
      current_turn: winner ? game.current_turn : opp,
      status: winner ? 'completed' : 'in_progress',
      winner,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)
    .eq('updated_at', game.updated_at)
    .eq('status', 'in_progress')
    .select('*')
    .maybeSingle()
  if (updErr) return json({ error: updErr.message }, 500)
  if (!updated) return json({ error: 'Game changed, refresh and try again' }, 409)

  return json({ game: updated })
})
