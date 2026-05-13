import { useState } from 'react'
import { avatarFor } from '../../../lib/avatar'
import ConfirmCard from './ConfirmCard.jsx'
import { assistantText } from '../../../lib/assistant/conversation.js'

const smallPrimary = (clr) => ({
  flex: 1, padding: '8px 12px', borderRadius: 999, border: 'none',
  background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
  color: '#FFF', fontSize: 12, fontWeight: 800, cursor: 'pointer',
})
const smallSecondary = (clr) => ({
  flex: 1, padding: '8px 12px', borderRadius: 999,
  border: `1.5px solid ${clr.border}`, background: clr.white,
  color: clr.textDark, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})

export default function PeopleStack({ message, ctx, clr, onClose, onAppendMessages }) {
  const [pendingConnect, setPendingConnect] = useState(null) // person | null

  if (pendingConnect) {
    return (
      <ConfirmCard
        clr={clr}
        title={`Connect with ${pendingConnect.name.split(' ')[0]}?`}
        subtitle="They'll get a request and can accept or decline."
        primaryLabel="Send request"
        onConfirm={async () => {
          try {
            await ctx.connectWithPerson(pendingConnect.id)
            onAppendMessages([assistantText(`Connection request sent to ${pendingConnect.name.split(' ')[0]}! ✓`)])
          } catch (err) {
            console.error('[PeopleStack] connectWithPerson failed', err)
            onAppendMessages([assistantText("Something went wrong sending the request. Try again?")])
          }
          setPendingConnect(null)
        }}
        onCancel={() => setPendingConnect(null)}
      />
    )
  }

  return (
    <div>
      {message.text && (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: clr.textMid }}>{message.text}</p>
      )}
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6,
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
      }}>
        {message.payload.people.map(p => {
          const isConnected = ctx.connections?.some(c => c.id === p.id)
          return (
            <div key={p.id} style={{
              flexShrink: 0, width: 240,
              backgroundColor: clr.white,
              borderRadius: 18, padding: 14,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              scrollSnapAlign: 'start',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <img
                src={avatarFor(p)} alt=""
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 14 }}
              />
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: clr.textDark }}>
                  {p.name}{p.age ? `, ${p.age}` : ''}
                </p>
                {p.city && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: clr.textMid }}>{p.city}</p>
                )}
              </div>
              {p.bio && (
                <p style={{
                  margin: 0, fontSize: 12, color: clr.textMid,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {p.bio}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(p.interests || []).slice(0, 3).map(i => (
                  <span key={i} style={{
                    padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    backgroundColor: clr.indigoLt, color: clr.indigo,
                  }}>{i}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => { onClose(); window.location.assign(`/user/${p.id}`) }}
                  style={smallSecondary(clr)}
                >
                  View
                </button>
                {!isConnected ? (
                  <button
                    type="button"
                    onClick={() => setPendingConnect(p)}
                    style={smallPrimary(clr)}
                  >
                    Connect
                  </button>
                ) : (
                  <button type="button" disabled style={{ ...smallPrimary(clr), opacity: 0.6, cursor: 'default' }}>
                    Connected ✓
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
