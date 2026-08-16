import { useState } from 'react'
import ConfirmCard from './ConfirmCard.jsx'
import { assistantText } from '../../../lib/assistant/conversation.js'
import CircleIcon from '../../ui/CircleIcon.jsx'
import { requiresApplication } from '../../../lib/circles.js'

export default function CircleList({ message, ctx, clr, onClose, onAppendMessages }) {
  const [pendingJoin, setPendingJoin] = useState(null) // circle | null

  if (pendingJoin) {
    return (
      <ConfirmCard
        clr={clr}
        title={`Join "${pendingJoin.name}"?`}
        subtitle="You'll be added as a member right away."
        primaryLabel="Join circle"
        onConfirm={async () => {
          try {
            await ctx.joinCircle(pendingJoin.id)
            onAppendMessages([
              assistantText(`You've joined "${pendingJoin.name}"! ✓`)
            ])
          } catch (err) {
            console.error('[CircleList] joinCircle failed', err)
            onAppendMessages([assistantText("Something went wrong. Please try again.")])
          }
          setPendingJoin(null)
        }}
        onCancel={() => setPendingJoin(null)}
      />
    )
  }

  return (
    <div>
      {message.text && (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: clr.textMid }}>{message.text}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {message.payload.circles.map(c => {
          const isJoined = ctx.joinedCircles?.includes(c.id)
          const isPrivate = c.type === 'private'
          return (
            <div
              key={c.id}
              style={{
                backgroundColor: clr.white, borderRadius: 16, padding: '12px 14px',
                boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                backgroundColor: clr.indigoLt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CircleIcon circle={c} size={22} color={clr.indigo} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <p style={{
                    margin: 0, fontSize: 14, fontWeight: 700, color: clr.textDark,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.name}
                  </p>
                  {isPrivate && (
                    <svg width="11" height="11" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: clr.textMid }}>
                  {c.memberCount ?? 0} members
                  {c.interestTag ? ` · ${c.interestTag}` : ''}
                </p>
                {(c.reason || message.reason) && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: clr.textMid, opacity: 0.8, fontStyle: 'italic' }}>
                    {c.reason || message.reason}
                  </p>
                )}
                {c.description && (
                  <p style={{
                    margin: '3px 0 0', fontSize: 12, color: clr.textMid,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                  }}>
                    {c.description}
                  </p>
                )}
              </div>
              {isJoined ? (
                <button
                  type="button"
                  onClick={() => { onClose?.(); window.location.assign(`/circles/${c.id}`) }}
                  style={{
                    flexShrink: 0, padding: '8px 14px', borderRadius: 999,
                    border: 'none', backgroundColor: clr.indigoLt,
                    color: clr.indigo, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Open ✓
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (requiresApplication(c)) { onClose?.(); window.location.assign(`/circles/${c.id}`); return }
                    setPendingJoin(c)
                  }}
                  style={{
                    flexShrink: 0, padding: '8px 14px', borderRadius: 999,
                    border: `1.5px solid ${clr.indigo}`,
                    backgroundColor: clr.white,
                    color: clr.indigo, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {requiresApplication(c) ? 'Apply' : 'Join'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
