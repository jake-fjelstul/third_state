import { describe, it, expect } from 'vitest'
import * as chess from '../games/chess.js'

describe('chess threefold repetition (L3)', () => {
  it('declares a draw after the same position occurs three times', () => {
    let s = chess.initialState()
    const shuffle = [
      [{ from: 'g1', to: 'f3' }, 'x'], [{ from: 'g8', to: 'f6' }, 'o'],
      [{ from: 'f3', to: 'g1' }, 'x'], [{ from: 'f6', to: 'g8' }, 'o'],
    ]
    for (let round = 0; round < 2; round++) {
      for (const [mv, p] of shuffle) {
        expect(chess.winner(s)).toBeNull()
        s = chess.applyMove(s, mv, p)
        expect(s).not.toBeNull()
      }
    }
    expect(chess.winner(s)).toBe('draw')
  })
})
