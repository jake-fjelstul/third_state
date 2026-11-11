import * as ttt from './ticTacToe'
import * as c4 from './connectFour'
import * as checkers from './checkers'
import * as chess from './chess'
import { Chess } from 'chess.js'

/*
 * Solo-mode opponents. Every search here is negamax: a position's score is
 * always from the point of view of the side to move, and a parent takes the
 * negation of its child's score. (The previous version scored from the AI's
 * fixed point of view and still negated, so the AI avoided its own wins.)
 *
 * Wins score BIG - depth (win sooner), losses -(BIG - depth) (lose later).
 */

const other = (p) => (p === 'x' ? 'o' : 'x')

/** Returns the AI's move. */
export function pickMove(gameType, state, aiPlayer = 'o') {
  if (gameType === 'tic_tac_toe') return pickTttMove(state, aiPlayer)
  if (gameType === 'connect_four') return pickC4Move(state, aiPlayer)
  if (gameType === 'checkers') return pickCheckersMove(state, aiPlayer)
  if (gameType === 'chess') return pickChessMove(state, aiPlayer)
  return null
}

// ---------- Tic-Tac-Toe: full search ----------

function tttSearch(state, toMove, depth) {
  const w = ttt.winner(state)
  if (w === 'draw') return 0
  if (w) return w === toMove ? 100 - depth : -(100 - depth)
  let best = -Infinity
  for (const idx of ttt.legalMoves(state)) {
    const score = -tttSearch(ttt.applyMove(state, idx, toMove), other(toMove), depth + 1)
    if (score > best) best = score
  }
  return best
}

function pickTttMove(state, ai) {
  let best = -Infinity
  let moves = []
  for (const idx of ttt.legalMoves(state)) {
    const score = -tttSearch(ttt.applyMove(state, idx, ai), other(ai), 1)
    if (score > best) { best = score; moves = [idx] }
    else if (score === best) moves.push(idx)
  }
  // Among equally good moves, vary the opening a little.
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null
}

// ---------- Connect Four: alpha-beta with a window heuristic ----------

const C4_ORDER = [3, 2, 4, 1, 5, 0, 6]
const C4_WIN = 100000

function c4Windows() {
  const out = []
  const { ROWS, COLS } = c4
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
      for (const [dr, dc] of dirs) {
        const cells = []
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break
          cells.push(rr * COLS + cc)
        }
        if (cells.length === 4) out.push(cells)
      }
    }
  }
  return out
}
const C4_WINDOWS = c4Windows()

function c4Heuristic(state, me) {
  const opp = other(me)
  const b = state.cells
  let score = 0
  // Centre column control.
  for (let r = 0; r < c4.ROWS; r++) {
    const v = b[r * c4.COLS + 3]
    if (v === me) score += 3
    else if (v === opp) score -= 3
  }
  for (const w of C4_WINDOWS) {
    let mine = 0, theirs = 0
    for (const i of w) {
      if (b[i] === me) mine++
      else if (b[i] === opp) theirs++
    }
    if (mine && theirs) continue
    if (mine === 3) score += 12
    else if (mine === 2) score += 4
    if (theirs === 3) score -= 14
    else if (theirs === 2) score -= 4
  }
  return score
}

function c4Search(state, toMove, depth, maxDepth, alpha, beta) {
  const w = c4.winner(state)
  if (w === 'draw') return 0
  if (w) return w === toMove ? C4_WIN - depth : -(C4_WIN - depth)
  if (depth === maxDepth) return c4Heuristic(state, toMove)
  const legal = c4.legalMoves(state)
  let best = -Infinity
  for (const col of C4_ORDER) {
    if (!legal.includes(col)) continue
    const score = -c4Search(c4.applyMove(state, col, toMove), other(toMove), depth + 1, maxDepth, -beta, -alpha)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function pickC4Move(state, ai) {
  const MAX_DEPTH = 6
  const legal = c4.legalMoves(state)
  let best = -Infinity, move = null
  for (const col of C4_ORDER) {
    if (!legal.includes(col)) continue
    const score = -c4Search(c4.applyMove(state, col, ai), other(ai), 1, MAX_DEPTH, -Infinity, Infinity)
    if (score > best) { best = score; move = col }
  }
  return move
}

// ---------- Checkers: alpha-beta on material ----------

const CK_WIN = 10000

function checkersMaterial(state, me) {
  const opp = other(me)
  let s = 0
  for (const c of state.cells) {
    if (c === '') continue
    const lower = c.toLowerCase()
    const isKing = c !== lower
    if (lower === me) s += isKing ? 1.7 : 1
    else if (lower === opp) s -= isKing ? 1.7 : 1
  }
  return s
}

function checkersSearch(state, toMove, depth, maxDepth, alpha, beta) {
  const w = checkers.winner(state)
  if (w === 'draw') return 0
  if (w) return w === toMove ? CK_WIN - depth : -(CK_WIN - depth)
  const moves = checkers.legalMoves(state, toMove)
  if (moves.length === 0) return -(CK_WIN - depth) // no moves = loss
  if (depth === maxDepth) return checkersMaterial(state, toMove)
  let best = -Infinity
  for (const m of moves) {
    const next = checkers.applyMove(state, m, toMove)
    if (!next) continue
    const score = -checkersSearch(next, other(toMove), depth + 1, maxDepth, -beta, -alpha)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function pickCheckersMove(state, ai) {
  const MAX_DEPTH = 5
  const moves = checkers.legalMoves(state, ai)
  if (moves.length === 0) return null
  let bestScore = -Infinity, best = moves[0]
  for (const m of moves) {
    const next = checkers.applyMove(state, m, ai)
    if (!next) continue
    const score = -checkersSearch(next, other(ai), 1, MAX_DEPTH, -Infinity, Infinity)
    if (score > bestScore) { bestScore = score; best = m }
  }
  return best
}

// ---------- Chess: alpha-beta on material, one board with move/undo ----------
// Re-parsing a FEN for every node was ~10x slower (1.5 s mid-game on a Mac).

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const CHESS_WIN = 100000

function chessMaterial(board, color) {
  let s = 0
  for (const row of board.board()) for (const sq of row) {
    if (!sq) continue
    const v = PIECE_VALUES[sq.type] || 0
    s += sq.color === color ? v : -v
  }
  return s * 100
}

// Captures and promotions first, so alpha-beta cuts more.
const moveGain = (m) => (PIECE_VALUES[m.captured] || 0) + (m.promotion ? 8 : 0)
const orderChessMoves = (moves) => [...moves].sort((a, b) => moveGain(b) - moveGain(a))

function chessSearch(board, depth, maxDepth, alpha, beta) {
  if (board.isCheckmate()) return -(CHESS_WIN - depth) // side to move is mated
  if (board.isDraw()) return 0
  if (depth === maxDepth) return chessMaterial(board, board.turn())
  let best = -Infinity
  for (const m of orderChessMoves(board.moves({ verbose: true }))) {
    board.move(m)
    const score = -chessSearch(board, depth + 1, maxDepth, -beta, -alpha)
    board.undo()
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function pickChessMove(state, ai) {
  const board = new Chess(state.fen)
  if (board.turn() !== (ai === 'x' ? 'w' : 'b')) return null
  const moves = board.moves({ verbose: true })
  if (moves.length === 0) return null
  // Busy middlegames search one ply less so a phone answers in about a second.
  const MAX_DEPTH = moves.length > 30 ? 2 : 3
  // Light shuffle so equal moves vary between games; captures still sort first.
  const shuffled = orderChessMoves(moves.map(m => [m, Math.random()]).sort((a, b) => a[1] - b[1]).map(x => x[0]))
  let bestScore = -Infinity, best = shuffled[0]
  for (const m of shuffled) {
    board.move(m)
    // Repetition by our stored history counts as a draw (rules module, L3).
    const next = chess.applyMove(state, { from: m.from, to: m.to, promotion: m.promotion }, ai)
    const score = next && chess.winner(next) === 'draw'
      ? 0
      : -chessSearch(board, 1, MAX_DEPTH, -Infinity, -bestScore)
    board.undo()
    if (score > bestScore) { bestScore = score; best = m }
  }
  return { from: best.from, to: best.to, promotion: best.promotion }
}
