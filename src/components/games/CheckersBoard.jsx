import { useState, useMemo } from 'react'
import * as checkers from '../../lib/games/checkers'

const LIGHT = '#F0D9B5'
const DARK = '#B58863'
const SELECTED_OUTLINE = 'var(--indigo)'

export default function CheckersBoard({ state, myToken, myTurn, onMove }) {
  const [selected, setSelected] = useState(null)

  const legal = useMemo(() => {
    if (!myTurn) return []
    return checkers.legalMoves(state, myToken)
  }, [state, myToken, myTurn])

  // Destinations reachable from the currently selected piece
  const destinations = useMemo(() => {
    if (selected == null) return new Set()
    return new Set(legal.filter(m => m.from === selected).map(m => m.to))
  }, [selected, legal])

  // All pieces that can move (have at least one legal move)
  const movablePieces = useMemo(() => {
    return new Set(legal.map(m => m.from))
  }, [legal])

  const handleClick = (idx) => {
    if (!myTurn) return

    const piece = state.cells[idx]
    const isOwn = myToken === 'x'
      ? (piece === 'x' || piece === 'X')
      : (piece === 'o' || piece === 'O')

    // If tapping a legal destination from the selected piece
    if (selected != null && destinations.has(idx)) {
      const candidates = legal.filter(m => m.from === selected && m.to === idx)
      // Pick the longest-capture path if multiple
      const best = candidates.reduce((a, b) =>
        (b.captures?.length || 0) > (a.captures?.length || 0) ? b : a
      , candidates[0])
      onMove(best)
      setSelected(null)
      return
    }

    // If tapping own piece that has moves
    if (isOwn && movablePieces.has(idx)) {
      setSelected(idx)
      return
    }

    // Otherwise deselect
    setSelected(null)
  }

  // Determine render order: flip for player O so their pieces are at bottom
  const indices = []
  if (myToken === 'o') {
    for (let i = checkers.CELL_COUNT - 1; i >= 0; i--) indices.push(i)
  } else {
    for (let i = 0; i < checkers.CELL_COUNT; i++) indices.push(i)
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
      {indices.map(idx => {
        const dark = checkers.isDarkSquare(idx)
        const isSelected = selected === idx
        const isDest = destinations.has(idx)
        const piece = state.cells[idx]

        return (
          <div
            key={idx}
            onClick={() => handleClick(idx)}
            style={{
              aspectRatio: '1',
              backgroundColor: dark ? DARK : LIGHT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: myTurn && (movablePieces.has(idx) || isDest) ? 'pointer' : 'default',
              position: 'relative',
              outline: isSelected ? `3px solid ${SELECTED_OUTLINE}` : 'none',
              outlineOffset: '-3px',
            }}
          >
            {/* Legal destination dot */}
            {isDest && !piece && (
              <div style={{
                width: '30%', height: '30%', borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.35)',
              }} />
            )}
            {/* Legal capture ring */}
            {isDest && piece && (
              <div style={{
                position: 'absolute', inset: '6%',
                borderRadius: '50%',
                border: '3px solid rgba(0,0,0,0.4)',
              }} />
            )}
            {/* Piece */}
            {piece && <CheckerPiece piece={piece} />}
          </div>
        )
      })}
    </div>
  )
}

function CheckerPiece({ piece }) {
  const isX = piece === 'x' || piece === 'X'
  const isKing = piece === 'X' || piece === 'O'
  const color = isX ? '#DC2626' : '#1F2937'
  const highlight = isX ? '#EF4444' : '#374151'

  return (
    <div style={{
      width: '75%', height: '75%', borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, ${highlight}, ${color})`,
      boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      {isKing && (
        <span style={{
          fontSize: 'clamp(12px, 3vw, 20px)',
          color: '#FFD700',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          lineHeight: 1,
        }}>
          ♛
        </span>
      )}
    </div>
  )
}
