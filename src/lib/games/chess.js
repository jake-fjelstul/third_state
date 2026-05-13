import { Chess } from 'chess.js'

export const TYPE = 'chess'

export function initialState() {
  return { fen: new Chess().fen(), lastMove: null }
}

function newChess(state) {
  return new Chess(state.fen)
}

/**
 * applyMove:
 *   move = { from: 'e2', to: 'e4', promotion?: 'q'|'r'|'b'|'n' }
 *   player = 'x' (white) | 'o' (black)
 * Returns new state or null if illegal.
 */
export function applyMove(state, move, player) {
  try {
    const c = newChess(state)
    const myColor = player === 'x' ? 'w' : 'b'
    if (c.turn() !== myColor) return null
    const mv = { ...move, promotion: move.promotion || 'q' }
    const result = c.move(mv)
    if (!result) return null
    return {
      fen: c.fen(),
      lastMove: { from: mv.from, to: mv.to, san: result.san },
    }
  } catch {
    return null
  }
}

/** Returns 'x' | 'o' | 'draw' | null. */
export function winner(state) {
  try {
    const c = newChess(state)
    if (c.isCheckmate()) {
      return c.turn() === 'w' ? 'o' : 'x'
    }
    if (c.isDraw() || c.isStalemate() || c.isInsufficientMaterial() || c.isThreefoldRepetition()) {
      return 'draw'
    }
    return null
  } catch {
    return null
  }
}

/** Legal moves from a specific square, as verbose chess.js move objects. */
export function legalMoves(state, fromSquare) {
  try {
    const c = newChess(state)
    return c.moves({ square: fromSquare, verbose: true })
  } catch {
    return []
  }
}

/** All legal moves for the side to move. */
export function allLegalMoves(state) {
  try {
    const c = newChess(state)
    return c.moves({ verbose: true })
  } catch {
    return []
  }
}

/** Returns 'w' or 'b' — whose turn it is in the state's FEN. */
export function turn(state) {
  try { return newChess(state).turn() } catch { return 'w' }
}

/** Returns the algebraic square of the king in check, or null. */
export function checkSquare(state) {
  try {
    const c = newChess(state)
    if (!c.inCheck()) return null
    const sideInCheck = c.turn()
    const board = c.board()
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = board[r][f]
      if (p && p.type === 'k' && p.color === sideInCheck) {
        return p.square
      }
    }
    return null
  } catch { return null }
}

/** Returns 2D board array (board[0] = rank 8). Used by the renderer. */
export function boardArray(state) {
  try { return newChess(state).board() } catch { return [] }
}
