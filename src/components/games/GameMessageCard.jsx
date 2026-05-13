import { useNavigate } from 'react-router-dom'
import { useGameState } from '../../hooks/useGameState.js'
import { GAME_TYPES } from '../../lib/games/index.js'
import GameBoard from './GameBoard.jsx'

const clr = {
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

export default function GameMessageCard({ payload, viewerId }) {
  const navigate = useNavigate()
  const { gameId, gameType } = payload
  const { game, loading } = useGameState(gameId)
  
  const typeMeta = GAME_TYPES[gameType]
  const title = typeMeta ? `${typeMeta.emoji} ${typeMeta.label}` : 'Game'

  if (loading || !game) {
    return (
      <div style={{
        backgroundColor: clr.white, border: `1.5px solid ${clr.border}`, borderRadius: 16,
        padding: 16, maxWidth: 280, minWidth: 200, boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: clr.textDark }}>{title}</span>
          <span style={{ fontSize: 12, color: clr.textMid, backgroundColor: '#F0F0F5', padding: '2px 8px', borderRadius: 12 }}>Loading</span>
        </div>
        <div style={{ height: 120, backgroundColor: '#F0F0F5', borderRadius: 12, marginBottom: 16 }} />
      </div>
    )
  }

  const myToken = game.playerX?.id === viewerId ? 'x' : game.playerO?.id === viewerId ? 'o' : null
  const isMyTurn = game.currentTurn === myToken
  
  let statusText = 'Unknown'
  let statusColor = clr.textMid
  let statusBg = '#F0F0F5'

  if (game.status === 'completed') {
    if (game.winner === myToken) {
      statusText = 'You won 🏆'
      statusColor = '#059669' // Green
      statusBg = '#D1FAE5'
    } else if (game.winner === 'draw') {
      statusText = 'Draw'
    } else {
      statusText = 'Lost'
      statusColor = '#DC2626' // Red
      statusBg = '#FEE2E2'
    }
  } else {
    if (isMyTurn) {
      statusText = 'Your turn'
      statusColor = clr.indigo
      statusBg = 'var(--indigoLt)'
    } else {
      statusText = 'Their turn'
    }
  }

  return (
    <div style={{
      backgroundColor: clr.white, border: `1.5px solid ${clr.border}`, borderRadius: 16,
      padding: 16, maxWidth: 280, minWidth: 240, boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: clr.textDark }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, backgroundColor: statusBg, padding: '4px 10px', borderRadius: 12 }}>
          {statusText}
        </span>
      </div>

      {/* Mini Board Preview */}
      <div style={{ transform: 'scale(0.6)', transformOrigin: 'top center', height: gameType === 'connect_four' ? 140 : 180, pointerEvents: 'none' }}>
        <GameBoard gameType={gameType} state={game.state} myToken={myToken} myTurn={false} onMove={() => {}} />
      </div>

      {/* Action */}
      <button 
        onClick={() => navigate(`/game/${gameId}`)}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
          background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          marginTop: 8
        }}
      >
        Open game
      </button>
    </div>
  )
}
