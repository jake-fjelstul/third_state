export const TYPE = 'tic_tac_toe'
export const CELL_COUNT = 9

export function initialState() {
  return { cells: Array(CELL_COUNT).fill('') }
}

/** Apply a move at index 0..8 for the given player ('x'|'o'). Returns new state or null if invalid. */
export function applyMove(state, index, player) {
  if (!state?.cells || index < 0 || index > 8) return null
  if (state.cells[index] !== '') return null
  const next = state.cells.slice()
  next[index] = player
  return { cells: next }
}

/** Returns 'x' | 'o' | 'draw' | null */
export function winner(state) {
  const b = state?.cells || []
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ]
  for (const [a,b2,c] of lines) {
    if (b[a] && b[a] === b[b2] && b[b2] === b[c]) return b[a]
  }
  if (b.every(v => v !== '')) return 'draw'
  return null
}

export function legalMoves(state) {
  return (state?.cells || []).map((v, i) => v === '' ? i : -1).filter(i => i >= 0)
}
