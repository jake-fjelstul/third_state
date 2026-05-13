import * as ttt from './ticTacToe'
import * as c4 from './connectFour'
import * as checkers from './checkers'
import * as chess from './chess'

/** Returns the AI's move. */
export function pickMove(gameType, state, aiPlayer = 'o') {
  if (gameType === 'tic_tac_toe')  return pickTttMove(state, aiPlayer)
  if (gameType === 'connect_four') return pickC4Move(state, aiPlayer)
  if (gameType === 'checkers')     return pickCheckersMove(state, aiPlayer)
  if (gameType === 'chess')        return pickChessMove(state, aiPlayer)
  return null
}

// ---------- Tic-Tac-Toe: full minimax ----------
function pickTttMove(state, ai) {
  const me = ai
  const opp = ai === 'x' ? 'o' : 'x'
  let best = -Infinity, move = null
  for (const idx of ttt.legalMoves(state)) {
    const next = ttt.applyMove(state, idx, me)
    const score = -negamax(next, opp, me, 0, ttt)
    if (score > best) { best = score; move = idx }
  }
  return move
}

function negamax(state, toMove, me, depth, mod) {
  const w = mod.winner(state)
  if (w === 'draw') return 0
  if (w === me) return 100 - depth
  if (w && w !== me) return -(100 - depth)
  let best = -Infinity
  for (const m of mod.legalMoves(state)) {
    const next = mod.applyMove(state, m, toMove)
    const opp = toMove === 'x' ? 'o' : 'x'
    const score = -negamax(next, opp, me, depth + 1, mod)
    if (score > best) best = score
  }
  return best
}

// ---------- Connect Four: depth-limited minimax with heuristic ----------
function pickC4Move(state, ai) {
  const me = ai
  const opp = ai === 'x' ? 'o' : 'x'
  const DEPTH = 4
  let best = -Infinity, move = null
  // Try center first for tie-breaking
  const order = [3, 2, 4, 1, 5, 0, 6].filter(c => c4.legalMoves(state).includes(c))
  for (const col of order) {
    const next = c4.applyMove(state, col, me)
    const score = -c4Negamax(next, opp, me, DEPTH - 1)
    if (score > best) { best = score; move = col }
  }
  return move
}

function c4Negamax(state, toMove, me, depth) {
  const w = c4.winner(state)
  if (w === me) return 10000 + depth
  if (w && w !== me && w !== 'draw') return -(10000 + depth)
  if (w === 'draw') return 0
  if (depth === 0) return c4Heuristic(state, me)
  let best = -Infinity
  const order = [3, 2, 4, 1, 5, 0, 6].filter(c => c4.legalMoves(state).includes(c))
  for (const col of order) {
    const next = c4.applyMove(state, col, toMove)
    const opp = toMove === 'x' ? 'o' : 'x'
    const score = -c4Negamax(next, opp, me, depth - 1)
    if (score > best) best = score
  }
  return best
}

function c4Heuristic(state, me) {
  let score = 0
  for (let r = 0; r < c4.ROWS; r++) {
    const v = state.cells[r * c4.COLS + 3]
    if (v === me) score += 3
    else if (v && v !== me) score -= 3
  }
  return score
}

// ---------- Checkers: depth-limited negamax with material eval ----------
function checkersMaterial(state, me) {
  let s = 0
  const opp = me === 'x' ? 'o' : 'x'
  for (const c of state.cells) {
    if (c === '') continue
    const lower = c.toLowerCase()
    const isKing = c !== lower
    if (lower === me) s += isKing ? 1.7 : 1
    else if (lower === opp) s -= isKing ? 1.7 : 1
  }
  return s
}

function pickCheckersMove(state, ai) {
  const DEPTH = 4
  const moves = checkers.legalMoves(state, ai)
  if (moves.length === 0) return null
  let bestScore = -Infinity, best = moves[0]
  for (const m of moves) {
    const next = checkers.applyMove(state, m, ai)
    if (!next) continue
    const score = -checkersNegamax(next, ai === 'x' ? 'o' : 'x', ai, DEPTH - 1)
    if (score > bestScore) { bestScore = score; best = m }
  }
  return best
}

function checkersNegamax(state, toMove, me, depth) {
  const w = checkers.winner(state)
  if (w === me) return 10000 + depth
  if (w === (me === 'x' ? 'o' : 'x')) return -(10000 + depth)
  if (w === 'draw') return 0
  if (depth === 0) return checkersMaterial(state, me)
  const moves = checkers.legalMoves(state, toMove)
  if (moves.length === 0) {
    // Side to move has no legal moves — they lose
    return toMove === me ? -(10000 + depth) : (10000 + depth)
  }
  let best = -Infinity
  for (const m of moves) {
    const next = checkers.applyMove(state, m, toMove)
    if (!next) continue
    const score = -checkersNegamax(next, toMove === 'x' ? 'o' : 'x', me, depth - 1)
    if (score > best) best = score
  }
  return best
}

// ---------- Chess: shallow material-only minimax ----------
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function chessMaterial(state, me) {
  const myColor = me === 'x' ? 'w' : 'b'
  const board = chess.boardArray(state)
  let s = 0
  for (const row of board) for (const sq of row) {
    if (!sq) continue
    const v = PIECE_VALUES[sq.type] || 0
    s += sq.color === myColor ? v : -v
  }
  return s
}

function pickChessMove(state, ai) {
  const DEPTH = 2
  const moves = chess.allLegalMoves(state)
  if (moves.length === 0) return null
  let bestScore = -Infinity, best = moves[0]
  // Light shuffle so the AI doesn't play identical openings every time
  const shuffled = moves.map(m => [m, Math.random()]).sort((a, b) => a[1] - b[1]).map(x => x[0])
  for (const m of shuffled) {
    const next = chess.applyMove(state, { from: m.from, to: m.to, promotion: m.promotion }, ai)
    if (!next) continue
    const score = -chessNegamax(next, ai === 'x' ? 'o' : 'x', ai, DEPTH - 1)
    if (score > bestScore) { bestScore = score; best = m }
  }
  return { from: best.from, to: best.to, promotion: best.promotion }
}

function chessNegamax(state, toMove, me, depth) {
  const w = chess.winner(state)
  if (w === me) return 100000 + depth
  if (w === (me === 'x' ? 'o' : 'x')) return -(100000 + depth)
  if (w === 'draw') return 0
  if (depth === 0) return chessMaterial(state, me) * 100
  const moves = chess.allLegalMoves(state)
  if (moves.length === 0) {
    return toMove === me ? -(100000 + depth) : (100000 + depth)
  }
  let best = -Infinity
  for (const m of moves) {
    const next = chess.applyMove(state, { from: m.from, to: m.to, promotion: m.promotion }, toMove)
    if (!next) continue
    const score = -chessNegamax(next, toMove === 'x' ? 'o' : 'x', me, depth - 1)
    if (score > best) best = score
  }
  return best
}
