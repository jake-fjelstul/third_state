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

export default function SoloGameModal({ gameType, onClose }) {
  const mod = GAME_TYPES[gameType]?.module
  if (!mod) return null

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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      backgroundColor: 'rgba(15,15,30,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '95vw', height: '95vh', maxWidth: 500,
        backgroundColor: clr.bg, borderRadius: 24,
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${clr.border}` }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: clr.textDark }}>
            Solo {GAME_TYPES[gameType].label}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="22" height="22" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Board Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20 }}>
          <GameBoard 
            gameType={gameType}
            state={state}
            myToken="x"
            myTurn={humanTurn && !winner}
            onMove={handleMove}
          />
          {!winner && (
            <p style={{ textAlign: 'center', marginTop: 32, fontSize: 16, color: clr.textMid, fontWeight: 600 }}>
              {humanTurn ? 'Your turn' : 'AI is thinking...'}
            </p>
          )}
        </div>

        {/* End Game Overlay */}
        {winner && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(15,15,30,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 24, zIndex: 10, backdropFilter: 'blur(4px)'
          }}>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#FFFFFF', textAlign: 'center', padding: '0 20px' }}>
              {winner === 'x' ? 'You won! 🏆' : winner === 'o' ? 'AI won' : 'Draw'}
            </h2>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={handleRematch} style={{
                padding: '12px 24px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(91,95,239,0.3)'
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
    </div>
  )
}
