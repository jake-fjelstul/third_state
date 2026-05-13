import { useState, useMemo } from 'react'
import * as chess from '../../lib/games/chess'

const LIGHT = '#F0D9B5'
const DARK = '#B58863'
const SELECTED_BG = 'rgba(91,95,239,0.4)'
const LAST_MOVE_BG = 'rgba(255,255,0,0.25)'
const CHECK_BG = 'rgba(239, 68, 68, 0.4)'

const FILES = ['a','b','c','d','e','f','g','h']

// Unicode chess pieces
const PIECE_CHARS = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}

function squareToAlg(rank, file) {
  return FILES[file] + (8 - rank)
}

export default function ChessBoard({ state, myToken, myTurn, onMove }) {
  const [selected, setSelected] = useState(null) // algebraic square like 'e2'

  const board = useMemo(() => chess.boardArray(state), [state])
  const inCheckSquare = useMemo(() => chess.checkSquare(state), [state])

  const legalFromSelected = useMemo(() => {
    if (!selected || !myTurn) return []
    return chess.legalMoves(state, selected)
  }, [state, selected, myTurn])

  const legalDestinations = useMemo(() => {
    return new Set(legalFromSelected.map(m => m.to))
  }, [legalFromSelected])

  // Determine whose pieces are "mine"
  const myColor = myToken === 'x' ? 'w' : 'b'
  const flipped = myToken === 'o' // Black plays from bottom

  const handleClick = (square) => {
    if (!myTurn) return

    // If a destination is clicked while a piece is selected
    if (selected && legalDestinations.has(square)) {
      onMove({ from: selected, to: square })
      setSelected(null)
      return
    }

    // Find what's on this square
    const algFile = FILES.indexOf(square[0])
    const algRank = 8 - parseInt(square[1])
    const piece = board[algRank]?.[algFile]

    // If clicking one of my own pieces
    if (piece && piece.color === myColor) {
      setSelected(square)
      return
    }

    // Otherwise deselect
    setSelected(null)
  }

  // Build rows in render order
  const rows = []
  for (let r = 0; r < 8; r++) {
    const rank = flipped ? 7 - r : r
    const cols = []
    for (let f = 0; f < 8; f++) {
      const file = flipped ? 7 - f : f
      const square = squareToAlg(rank, file)
      const isDark = (rank + file) % 2 === 1
      const piece = board[rank]?.[file]
      const isSelected = selected === square
      const isDest = legalDestinations.has(square)
      const isLastMoveFrom = state.lastMove?.from === square
      const isLastMoveTo = state.lastMove?.to === square
      const isCheck = inCheckSquare === square

      let bg = isDark ? DARK : LIGHT
      if (isSelected) bg = SELECTED_BG
      else if (isCheck) bg = CHECK_BG
      else if (isLastMoveFrom || isLastMoveTo) bg = isDark ? 'rgba(186,202,68,0.6)' : 'rgba(246,246,105,0.5)'

      cols.push(
        <div
          key={square}
          onClick={() => handleClick(square)}
          style={{
            aspectRatio: '1',
            backgroundColor: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: myTurn ? 'pointer' : 'default',
            position: 'relative',
            transition: 'background-color 0.1s ease',
          }}
        >
          {/* Rank label on left edge */}
          {f === 0 && (
            <span style={{
              position: 'absolute', top: 2, left: 3,
              fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 700,
              color: isDark ? LIGHT : DARK, opacity: 0.8,
              pointerEvents: 'none', userSelect: 'none',
            }}>
              {8 - rank}
            </span>
          )}
          {/* File label on bottom edge */}
          {r === 7 && (
            <span style={{
              position: 'absolute', bottom: 1, right: 3,
              fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 700,
              color: isDark ? LIGHT : DARK, opacity: 0.8,
              pointerEvents: 'none', userSelect: 'none',
            }}>
              {FILES[file]}
            </span>
          )}
          {/* Legal destination dot */}
          {isDest && !piece && (
            <div style={{
              width: '30%', height: '30%', borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.25)',
            }} />
          )}
          {/* Legal capture ring */}
          {isDest && piece && (
            <div style={{
              position: 'absolute', inset: '6%',
              borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.3)',
            }} />
          )}
          {/* Piece */}
          {piece && (
            <span style={{
              fontSize: 'clamp(28px, 7vw, 52px)',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
              filter: piece.color === 'b'
                ? 'drop-shadow(0 1px 1px rgba(255,255,255,0.3))'
                : 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}>
              {PIECE_CHARS[piece.color + piece.type]}
            </span>
          )}
        </div>
      )
    }
    rows.push(cols)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(8, 1fr)',
      width: '100%',
      aspectRatio: '1',
      maxWidth: 'min(92vw, 480px)',
      margin: '0 auto',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      {rows.flat()}
    </div>
  )
}
