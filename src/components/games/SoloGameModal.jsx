import { createPortal } from 'react-dom'
import { NavBar } from '../ui/ds.jsx'
import { useState, useEffect } from 'react'
import GameBoard from './GameBoard.jsx'
import { GAME_TYPES } from '../../lib/games/index.js'
import { pickMove } from '../../lib/games/ai.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

// Null check in a wrapper so the body's hooks always run (L1).
export default function SoloGameModal({ gameType, onClose }) {
  const mod = GAME_TYPES[gameType]?.module
  if (!mod) return null
  return <SoloGameModalBody gameType={gameType} mod={mod} onClose={onClose} />
}

function SoloGameModalBody({ gameType, mod, onClose }) {

  const [state, setState] = useState(mod.initialState())
  const [humanTurn, setHumanTurn] = useState(true)
  const [winner, setWinner] = useState(null)

  const handleMove = (arg) => {
    if (!humanTurn || winner) return
    const nextState = mod.applyMove(state, arg, 'x')
    if (!nextState) return
    
    setState(nextState)
    let win = mod.winner(nextState)
    // For checkers: if AI has no legal moves after human's move, human wins
    if (!win && mod.noMovesFor && mod.noMovesFor(nextState, 'o')) {
      win = 'x'
    }
    if (win) {
      setWinner(win)
      return
    }

    setHumanTurn(false)
  }

  // AI turn
  useEffect(() => {
    if (humanTurn || winner) return
    
    const timer = setTimeout(() => {
      const aiMove = pickMove(gameType, state, 'o')
      if (aiMove !== null) {
        const nextState = mod.applyMove(state, aiMove, 'o')
        if (nextState) {
          setState(nextState)
          let win = mod.winner(nextState)
          // For checkers: if human has no legal moves after AI's move, AI wins
          if (!win && mod.noMovesFor && mod.noMovesFor(nextState, 'x')) {
            win = 'o'
          }
          if (win) {
            setWinner(win)
          } else {
            setHumanTurn(true)
          }
        } else {
          setHumanTurn(true)
        }
      } else {
        // AI has no moves — human wins
        setWinner('x')
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [humanTurn, winner, state, gameType, mod])

  const handleRematch = () => {
    setState(mod.initialState())
    setHumanTurn(true)
    setWinner(null)
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400, backgroundColor: clr.bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'none',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header */}
        <div style={{ paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
          <NavBar onBack={onClose} title={`Solo ${GAME_TYPES[gameType].label}`} />
        </div>

        <p style={{ textAlign: 'center', margin: '14px 0 4px', fontSize: 16, color: clr.textMid, fontWeight: 600, flexShrink: 0, minHeight: 22 }}>
          {winner ? '' : humanTurn ? 'Your turn' : 'Thinking…'}
        </p>

        {/* Board: takes the leftover height; square boards size to min(width, height) */}
        <div style={{
          flex: 1, minHeight: 0, padding: '8px 16px calc(24px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size',
        }}>
          <div style={{ width: 'min(100cqw, 100cqh)', maxWidth: 480 }}>
            <GameBoard
              gameType={gameType}
              state={state}
              myToken="x"
              myTurn={humanTurn && !winner}
              onMove={handleMove}
            />
          </div>
        </div>

        {/* End Game Overlay */}
        {winner && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.78)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 24, zIndex: 10, backdropFilter: 'blur(4px)'
          }}>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#FFFFFF', textAlign: 'center', padding: '0 20px' }}>
              {winner === 'x' ? 'You won' : winner === 'o' ? 'AI won' : 'Draw'}
            </h2>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={handleRematch} style={{
                padding: '12px 24px', borderRadius: 12, border: 'none',
                background: 'var(--accent)',
                color: 'var(--on-accent)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: 'none'
              }}>
                Rematch
              </button>
              <button onClick={onClose} style={{
                padding: '12px 24px', borderRadius: 12, border: `1.5px solid ${clr.border}`,
                background: 'transparent',
                color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: 'pointer'
              }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
