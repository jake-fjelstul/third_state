import { GAME_LIST } from '../../lib/games/index.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

export default function GamePicker({ opponent, chatId, onChallenge, onSoloSelected, onClose, anchor = 'bottom-left' }) {
  const isBottom = anchor === 'bottom-left'
  
  return (
    <>
      {/* Invisible backdrop to close on click outside */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 290 }} />
      
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute',
        ...(isBottom 
          ? { bottom: 'calc(100% + 12px)', left: 0 } 
          : { top: 'calc(100% + 12px)', right: 0 }
        ),
        width: 320,
        backgroundColor: clr.bg,
        borderRadius: 24,
        maxHeight: 400, display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: `1.5px solid ${clr.border}`,
        animation: 'fadeIn 0.15s ease',
        zIndex: 300,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: clr.textDark }}>Pick a game</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Game list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {GAME_LIST.map(game => (
            <div key={game.id} style={{
              backgroundColor: clr.white, borderRadius: 20, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 36 }}>{game.emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: clr.textDark }}>{game.label}</p>
                  <p style={{ margin: 0, fontSize: 13, color: clr.textMid }}>{game.blurb}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {opponent && (
                  <button onClick={() => onChallenge(game.id)} type="button" style={{
                    flex: 1, padding: '10px 12px', borderRadius: 12, border: 'none',
                    background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    Play {opponent.firstName || opponent.name?.split(' ')[0] || 'them'}
                  </button>
                )}
                <button onClick={() => onSoloSelected(game.id)} type="button" style={{
                  flex: 1, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${clr.border}`,
                  background: 'transparent',
                  color: clr.textDark, fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>
                  Solo mode
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
