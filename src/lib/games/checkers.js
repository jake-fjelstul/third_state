export const TYPE = 'checkers'
export const ROWS = 8
export const COLS = 8
export const CELL_COUNT = ROWS * COLS  // 64

// Cell encoding:
//   '' = empty (also: light squares are always '')
//   'x' = X regular, 'X' = X king
//   'o' = O regular, 'O' = O king

export function initialState() {
  const cells = Array(CELL_COUNT).fill('')
  for (let r = 0; r < 3; r++) for (let c = 0; c < COLS; c++) {
    if ((r + c) % 2 === 1) cells[r * COLS + c] = 'o'
  }
  for (let r = 5; r < 8; r++) for (let c = 0; c < COLS; c++) {
    if ((r + c) % 2 === 1) cells[r * COLS + c] = 'x'
  }
  return { cells, mustContinueFrom: null }
}

export function idxToRC(idx) { return [Math.floor(idx / COLS), idx % COLS] }
export function rcToIdx(r, c) { return r * COLS + c }
export function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS }

function isOwn(piece, player) {
  return player === 'x' ? (piece === 'x' || piece === 'X') : (piece === 'o' || piece === 'O')
}
function isOpponent(piece, player) {
  return piece !== '' && !isOwn(piece, player)
}
function isKing(piece) { return piece === 'X' || piece === 'O' }

function directionsFor(piece) {
  if (piece === 'X' || piece === 'O') return [[-1,-1],[-1,1],[1,-1],[1,1]]
  if (piece === 'x') return [[-1,-1],[-1,1]]                // X moves up
  if (piece === 'o') return [[1,-1],[1,1]]                  // O moves down
  return []
}

/** All jumps reachable from `idx` (single hops only; chains are explored by the caller). */
function singleJumpsFrom(cells, idx, player, pieceOverride) {
  const piece = pieceOverride ?? cells[idx]
  if (!isOwn(piece, player)) return []
  const [r, c] = idxToRC(idx)
  const out = []
  for (const [dr, dc] of directionsFor(piece)) {
    const mr = r + dr, mc = c + dc
    const lr = r + 2*dr, lc = c + 2*dc
    if (!inBounds(lr, lc)) continue
    const mid = cells[rcToIdx(mr, mc)]
    const land = cells[rcToIdx(lr, lc)]
    if (isOpponent(mid, player) && land === '') {
      out.push({ to: rcToIdx(lr, lc), captured: rcToIdx(mr, mc) })
    }
  }
  return out
}

/** All simple moves (no captures) from idx. */
function simpleMovesFrom(cells, idx, player) {
  const piece = cells[idx]
  if (!isOwn(piece, player)) return []
  const [r, c] = idxToRC(idx)
  const out = []
  for (const [dr, dc] of directionsFor(piece)) {
    const nr = r + dr, nc = c + dc
    if (!inBounds(nr, nc)) continue
    if (cells[rcToIdx(nr, nc)] === '') out.push({ to: rcToIdx(nr, nc) })
  }
  return out
}

/** All complete jump paths from idx (DFS for multi-jumps). */
function allJumpPathsFrom(cells, idx, player) {
  const results = []
  const piece = cells[idx]
  function recurse(curIdx, curPiece, working, board) {
    const jumps = singleJumpsFrom(board, curIdx, player, curPiece)
    if (jumps.length === 0) {
      if (working.captures.length > 0) results.push({
        path: [...working.path],
        captures: [...working.captures],
      })
      return
    }
    for (const j of jumps) {
      const next = board.slice()
      next[curIdx] = ''
      next[j.captured] = ''
      // Promote if reached last row
      let landPiece = curPiece
      const [lr] = idxToRC(j.to)
      if (curPiece === 'x' && lr === 0) landPiece = 'X'
      else if (curPiece === 'o' && lr === ROWS - 1) landPiece = 'O'
      next[j.to] = landPiece
      working.path.push(j.to)
      working.captures.push(j.captured)
      recurse(j.to, landPiece, working, next)
      working.path.pop()
      working.captures.pop()
    }
  }
  recurse(idx, piece, { path: [idx], captures: [] }, cells)
  return results
}

/**
 * legalMoves(state, player):
 *   - If mustContinueFrom is set: only further jumps from that square are legal.
 *   - If any captures exist anywhere on the board for player: only capture paths are legal.
 *   - Otherwise simple moves are legal.
 *
 * Returns array of move objects:
 *   { from, to, kind: 'move' }                       (simple)
 *   { from, to, kind: 'jump', path, captures }       (single or multi-jump path)
 */
export function legalMoves(state, player) {
  const cells = state.cells
  const sources = state.mustContinueFrom != null ? [state.mustContinueFrom]
    : cells.map((p, i) => isOwn(p, player) ? i : -1).filter(i => i >= 0)

  // First pass: collect any jumps anywhere for this player
  const allJumps = []
  if (state.mustContinueFrom != null) {
    for (const path of allJumpPathsFrom(cells, state.mustContinueFrom, player)) {
      allJumps.push({
        from: state.mustContinueFrom,
        to: path.path[path.path.length - 1],
        kind: 'jump',
        path: path.path,
        captures: path.captures,
      })
    }
  } else {
    for (const from of sources) {
      for (const path of allJumpPathsFrom(cells, from, player)) {
        allJumps.push({ from, to: path.path[path.path.length - 1], kind: 'jump', path: path.path, captures: path.captures })
      }
    }
  }
  if (allJumps.length > 0) return allJumps

  // No jumps — return simple moves (only if not in must-continue mode)
  if (state.mustContinueFrom != null) return []

  const simple = []
  for (const from of sources) {
    for (const m of simpleMovesFrom(cells, from, player)) {
      simple.push({ from, to: m.to, kind: 'move' })
    }
  }
  return simple
}

/**
 * Apply a move. Returns new state or null if illegal.
 * `move` shape matches an entry returned by legalMoves.
 */
export function applyMove(state, move, player) {
  const legal = legalMoves(state, player)
  const match = legal.find(m =>
    m.from === move.from && m.to === move.to &&
    (m.kind === 'move' || JSON.stringify(m.path) === JSON.stringify(move.path))
  )
  if (!match) return null

  const next = state.cells.slice()
  if (match.kind === 'jump') {
    let curPiece = next[match.from]
    next[match.from] = ''
    for (const cap of match.captures) next[cap] = ''
    // Walk the path, promoting at any king row touch
    for (const stop of match.path.slice(1)) {
      const [r] = idxToRC(stop)
      if (curPiece === 'x' && r === 0) curPiece = 'X'
      else if (curPiece === 'o' && r === ROWS - 1) curPiece = 'O'
    }
    next[match.to] = curPiece
  } else {
    let p = next[match.from]
    const [r] = idxToRC(match.to)
    if (p === 'x' && r === 0) p = 'X'
    else if (p === 'o' && r === ROWS - 1) p = 'O'
    next[match.from] = ''
    next[match.to] = p
  }
  return { cells: next, mustContinueFrom: null }
}

/** Compute terminal status. Returns 'x' | 'o' | 'draw' | null. */
export function winner(state) {
  const cells = state.cells
  const hasX = cells.some(p => p === 'x' || p === 'X')
  const hasO = cells.some(p => p === 'o' || p === 'O')
  if (!hasX) return 'o'
  if (!hasO) return 'x'
  return null
}

/** Helper for the play screen: detect whether the opponent has zero legal moves. */
export function noMovesFor(state, player) {
  return legalMoves(state, player).length === 0
}

export const isDarkSquare = (idx) => {
  const [r, c] = idxToRC(idx)
  return (r + c) % 2 === 1
}
