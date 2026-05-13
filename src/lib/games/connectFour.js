export const TYPE = 'connect_four'
export const ROWS = 6
export const COLS = 7
export const CELL_COUNT = ROWS * COLS  // 42

export function initialState() {
  return { cells: Array(CELL_COUNT).fill('') }
}

/** Apply a column drop (0..6) for player. Returns new state or null if column full. */
export function applyMove(state, col, player) {
  if (!state?.cells || col < 0 || col >= COLS) return null
  // Find lowest empty row in that column (row index COUNTING FROM TOP = 0..5).
  for (let row = ROWS - 1; row >= 0; row--) {
    const idx = row * COLS + col
    if (state.cells[idx] === '') {
      const next = state.cells.slice()
      next[idx] = player
      return { cells: next }
    }
  }
  return null  // column full
}

export function winner(state) {
  const b = state?.cells || []
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const i = r*COLS + c
      if (b[i] && b[i] === b[i+1] && b[i] === b[i+2] && b[i] === b[i+3]) return b[i]
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const i = r*COLS + c
      if (b[i] && b[i] === b[i+COLS] && b[i] === b[i+2*COLS] && b[i] === b[i+3*COLS]) return b[i]
    }
  }
  // Diag down-right
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const i = r*COLS + c
      if (b[i] && b[i] === b[i+COLS+1] && b[i] === b[i+2*COLS+2] && b[i] === b[i+3*COLS+3]) return b[i]
    }
  }
  // Diag down-left
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      const i = r*COLS + c
      if (b[i] && b[i] === b[i+COLS-1] && b[i] === b[i+2*COLS-2] && b[i] === b[i+3*COLS-3]) return b[i]
    }
  }
  if (b.every(v => v !== '')) return 'draw'
  return null
}

export function legalMoves(state) {
  const cols = []
  for (let c = 0; c < COLS; c++) {
    // Column has space if top cell is empty
    if (state.cells[c] === '') cols.push(c)
  }
  return cols
}
