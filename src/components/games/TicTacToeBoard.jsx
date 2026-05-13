import { useState } from 'react'

const clr = {
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  border: 'var(--border)',
}

export default function TicTacToeBoard({ state, myTurn, onMove }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const cells = state?.cells || Array(9).fill('')

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      width: '100%', maxWidth: 320, margin: '0 auto'
    }}>
      {cells.map((cell, i) => {
        const canPlay = cell === '' && myTurn
        const isHovered = canPlay && hoverIdx === i
        
        return (
          <div
            key={i}
            onClick={() => canPlay && onMove(i)}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{
              aspectRatio: '1', backgroundColor: isHovered ? clr.indigoLt : clr.white,
              border: `2px solid ${clr.border}`, borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canPlay ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease'
            }}
          >
            {cell === 'x' && <span style={{ color: clr.indigo, fontSize: 64, fontWeight: 800 }}>X</span>}
            {cell === 'o' && <span style={{ color: '#EF4444', fontSize: 64, fontWeight: 800 }}>O</span>}
          </div>
        )
      })}
    </div>
  )
}
