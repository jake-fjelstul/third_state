import { describe, expect, it } from 'vitest'
import { pickMove } from '../games/ai.js'
import * as checkers from '../games/checkers.js'
import * as chess from '../games/chess.js'

const empty42 = () => Array(42).fill('')

describe('solo AI', () => {
  it('tic-tac-toe takes an immediate win', () => {
    // o o _ / x x _ / _ _ _  -> o wins at 2 (blocking at 5 is worse)
    const move = pickMove('tic_tac_toe', { cells: ['o', 'o', '', 'x', 'x', '', '', '', ''] }, 'o')
    expect(move).toBe(2)
  })

  it('tic-tac-toe blocks an immediate loss', () => {
    const move = pickMove('tic_tac_toe', { cells: ['x', 'x', '', 'o', '', '', '', '', ''] }, 'o')
    expect(move).toBe(2)
  })

  it('connect four takes a horizontal win', () => {
    const cells = empty42()
    cells[35] = 'o'; cells[36] = 'o'; cells[37] = 'o' // bottom row, cols 0-2
    cells[39] = 'x'; cells[40] = 'x'; cells[41] = 'x' // cols 4-6
    expect(pickMove('connect_four', { cells }, 'o')).toBe(3)
  })

  it('connect four blocks a vertical threat', () => {
    const cells = empty42()
    cells[41] = 'x'; cells[34] = 'x'; cells[27] = 'x' // col 6, three high
    cells[35] = 'o'; cells[36] = 'o'
    expect(pickMove('connect_four', { cells }, 'o')).toBe(6)
  })

  it('checkers returns a legal opening move', () => {
    const state = checkers.initialState()
    const move = pickMove('checkers', state, 'o')
    expect(checkers.applyMove(state, move, 'o')).not.toBeNull()
  })

  it('chess finds mate in one', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
    const state = { fen, lastMove: null, history: [] }
    const move = pickMove('chess', state, 'x')
    expect(move).toMatchObject({ from: 'f3', to: 'f7' })
    expect(chess.winner(chess.applyMove(state, move, 'x'))).toBe('x')
  })

  it('stays fast enough to feel instant', () => {
    const t0 = performance.now()
    pickMove('connect_four', { cells: empty42() }, 'o')
    pickMove('chess', chess.initialState(), 'x')
    expect(performance.now() - t0).toBeLessThan(2500)
  })
})
