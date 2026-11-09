import { useState } from 'react'

export default function ConnectFourBoard({ state, myTurn, onMove }) {
  const ROWS = 6
  const COLS = 7
  const cells = state?.cells || Array(42).fill('')

  return (
    <div style={{
      backgroundColor: 'var(--surface-3)', padding: 12, borderRadius: 20,
      display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6,
      width: '100%', maxWidth: 400, margin: '0 auto'
    }}>
      {Array.from({ length: COLS }).map((_, c) => {
        // Can play if top cell is empty
        const canPlay = myTurn && cells[c] === ''
        
        return (
          <div
            key={c}
            onClick={() => canPlay && onMove(c)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              cursor: canPlay ? 'pointer' : 'default',
            }}
          >
            {Array.from({ length: ROWS }).map((_, r) => {
              const idx = r * COLS + c
              const val = cells[idx]
              let bg = 'var(--bg)'
              if (val === 'x') bg = 'var(--accent)'
              if (val === 'o') bg = 'var(--ink)'
              
              return (
                <div key={r} style={{
                  backgroundColor: bg, borderRadius: '50%', aspectRatio: '1',
                  transition: 'background-color 0.2s ease'
                }} />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
