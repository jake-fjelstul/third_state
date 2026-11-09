import { PageSkeleton } from '../components/ui/Skeleton.jsx'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { useGameState } from '../hooks/useGameState.js'
import { GAME_TYPES } from '../lib/games/index.js'
import GameBoard from '../components/games/GameBoard.jsx'
import { avatarFor } from '../lib/avatar.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

export default function GamePlay() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { currentUser, makeGameMove, forfeitGame, startChatGame } = useAppContext()
  const { game, loading, error } = useGameState(gameId)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (loading) {
    return <div style={{ paddingTop: 'env(safe-area-inset-top)' }}><PageSkeleton /></div>
  }

  if (error || !game) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: clr.textMid }}>
        <p>Could not load game</p>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', borderRadius: 12, border: `1.5px solid ${clr.border}`, background: 'transparent' }}>Go back</button>
      </div>
    )
  }

  const typeMeta = GAME_TYPES[game.type]
  const myToken = game.playerX?.id === currentUser?.id ? 'x' : game.playerO?.id === currentUser?.id ? 'o' : null
  const isMyTurn = game.currentTurn === myToken && game.status === 'in_progress'

  const handleMove = async (arg) => {
    if (!isMyTurn) return
    // Check locally first so illegal taps don't hit the network; the server
    // re-validates with the same rules and decides the winner.
    if (!typeMeta.module.applyMove(game.state, arg, myToken)) return

    try {
      await makeGameMove({ gameId, move: arg })
    } catch (err) {
      console.error(err)
      setToast('Something changed — refreshing…')
    }
  }

  const handleResign = async () => {
    if (!window.confirm("Are you sure you want to resign?")) return
    try {
      await forfeitGame(gameId)
    } catch (err) {
      console.error(err)
      setToast('Could not resign.')
    }
  }

  const handleRematch = async () => {
    try {
      await startChatGame({ chatId: game.chatId, gameType: game.type })
      navigate(`/chat/${game.chatId}`)
    } catch (err) {
      console.error(err)
      setToast('Failed to start rematch.')
    }
  }

  let statusText = ''
  if (game.status === 'completed') {
    if (game.winner === 'draw') statusText = 'Draw'
    else if (game.winner === myToken) statusText = 'You won! 🏆'
    else statusText = `${game.winner === 'x' ? game.playerX.name : game.playerO.name} won`
  } else {
    statusText = isMyTurn ? 'Your turn' : `${game.currentTurn === 'x' ? game.playerX.name : game.playerO.name}'s turn`
  }

  const avatarRing = (token) => ({
    padding: 3, borderRadius: '50%',
    border: `3px solid ${game.currentTurn === token && game.status === 'in_progress' ? clr.indigo : 'transparent'}`,
    transition: 'border-color 0.3s ease',
  })

  // Layout: header, players, board, actions in one flex column that fits the
  // space above the tab bar. The board shrinks to whatever height is left, so
  // Resign is never pushed off-screen (item 13).
  return (
    <div style={{
      position: 'relative',
      height: '100dvh',
      backgroundColor: clr.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans','Inter',sans-serif",
    }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'max(12px, calc(env(safe-area-inset-top) + 8px)) 16px 10px', borderBottom: `1px solid ${clr.border}`, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" fill="none" stroke={clr.textDark} strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 700, color: clr.textDark }}>
          {typeMeta.label}
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Players Row */}
      <div style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={avatarRing('x')}>
            <img src={avatarFor(game.playerX)} alt="X" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: clr.textDark }}>{game.playerX.name?.split(' ')[0]}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: clr.textMid }}>VS</span>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: clr.textDark, fontWeight: 700 }}>{statusText}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={avatarRing('o')}>
            <img src={avatarFor(game.playerO)} alt="O" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: clr.textDark }}>{game.playerO.name?.split(' ')[0]}</span>
        </div>
      </div>

      {/* Board: takes the leftover height; square boards size to min(width, height) */}
      <div style={{
        flex: 1, minHeight: 0, padding: '4px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        containerType: 'size',
      }}>
        <div style={{ width: 'min(100cqw, 100cqh)', maxWidth: 480 }}>
          <GameBoard
            gameType={game.type}
            state={game.state}
            myToken={myToken}
            myTurn={isMyTurn}
            onMove={handleMove}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => navigate(`/chat/${game.chatId}`)}
          style={{
            flex: 1, minHeight: 48, padding: '12px', borderRadius: 16, border: `1.5px solid ${clr.border}`,
            background: 'transparent', color: clr.textDark, fontSize: 15, fontWeight: 700, cursor: 'pointer'
          }}
        >
          Back to chat
        </button>
        {game.status === 'in_progress' && (
          <button
            onClick={handleResign}
            style={{
              flex: 1, minHeight: 48, padding: '12px', borderRadius: 16, border: 'none',
              background: '#FEE2E2', color: '#DC2626', fontSize: 15, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Resign
          </button>
        )}
      </div>

      {/* End Game Overlay */}
      {game.status === 'completed' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(15,15,30,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 24, zIndex: 10, backdropFilter: 'blur(4px)'
        }}>
          <h2 style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#FFFFFF', textAlign: 'center', padding: '0 20px' }}>
            {statusText}
          </h2>
          <div style={{ display: 'flex', gap: 16 }}>
            <button 
              onClick={handleRematch}
              style={{
                padding: '14px 28px', borderRadius: 16, border: 'none',
                background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(91,95,239,0.3)'
              }}
            >
              Rematch
            </button>
            <button 
              onClick={() => navigate(`/chat/${game.chatId}`)}
              style={{
                padding: '14px 24px', borderRadius: 16, border: `1.5px solid ${clr.border}`,
                background: 'transparent', color: '#FFFFFF', fontSize: 16, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#333', color: '#fff', padding: '12px 24px', borderRadius: 24,
          fontSize: 14, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
