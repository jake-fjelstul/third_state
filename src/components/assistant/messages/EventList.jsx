import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { avatarFor } from '../../../lib/avatar'
import ConfirmCard from './ConfirmCard.jsx'
import { assistantText } from '../../../lib/assistant/conversation.js'

const EVENT_GRADIENTS = [
  'var(--indigo)',
  'linear-gradient(135deg,#0D9488,#34D399)',
  'linear-gradient(135deg,#D97706,#FCD34D)',
  'linear-gradient(135deg,#E11D48,#FB7185)',
]

export default function EventList({ message, ctx, clr, onAppendMessages }) {
  const [pendingRsvp, setPendingRsvp] = useState(null) // event | null

  if (pendingRsvp) {
    return (
      <ConfirmCard
        clr={clr}
        title={`RSVP to "${pendingRsvp.title}"?`}
        subtitle={`${pendingRsvp.date}${pendingRsvp.time ? ` at ${pendingRsvp.time}` : ''}${pendingRsvp.location ? ` · ${pendingRsvp.location}` : ''}`}
        primaryLabel="Confirm RSVP"
        onConfirm={async () => {
          try {
            await ctx.rsvpEvent(pendingRsvp)
            onAppendMessages([assistantText(`You're going to "${pendingRsvp.title}"! See it on your Schedule. ✓`)])
          } catch (err) {
            console.error('[EventList] rsvpEvent failed', err)
            onAppendMessages([assistantText("Something went wrong with your RSVP. Try again?")])
          }
          setPendingRsvp(null)
        }}
        onCancel={() => setPendingRsvp(null)}
      />
    )
  }

  return (
    <div>
      {message.text && (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: clr.textMid }}>{message.text}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {message.payload.events.map((event, idx) => {
          const isRsvpd = ctx.isRsvpd?.(event.id)
          return (
            <div
              key={event.id}
              style={{
                backgroundColor: clr.white, borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 0 0 1px var(--border)',
                display: 'flex', alignItems: 'stretch',
              }}
            >
              {/* Colour stripe */}
              <div style={{
                width: 6, flexShrink: 0,
                background: EVENT_GRADIENTS[idx % EVENT_GRADIENTS.length],
              }} />
              <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                <p style={{
                  margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: clr.textDark,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {event.emoji ? event.emoji : <Calendar size={14} color={clr.indigo} />} {event.title}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: clr.textMid }}>
                  {event.dateLabel || event.date}{event.timeLabel ? ` · ${event.timeLabel}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
                {event.circleName && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: clr.textLight }}>
                    {event.circleName}
                  </p>
                )}
                {(event.reason || message.reason) && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: clr.textMid, opacity: 0.8, fontStyle: 'italic' }}>
                    {event.reason || message.reason}
                  </p>
                )}
                {event.attendees?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <div style={{ display: 'flex' }}>
                      {event.attendees.slice(0, 3).map((a, i) => (
                        <img key={i} src={avatarFor(a)} alt=""
                          style={{
                            width: 18, height: 18, borderRadius: '50%', objectFit: 'cover',
                            border: `2px solid ${clr.white}`, marginLeft: i === 0 ? 0 : -6,
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: clr.textLight }}>
                      {event.attendeesCount || event.attendees.length}+ going
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 0' }}>
                {isRsvpd ? (
                  <button type="button" disabled style={{
                    padding: '8px 14px', borderRadius: 999, border: 'none',
                    backgroundColor: clr.indigoLt, color: clr.indigo,
                    fontSize: 12, fontWeight: 700, cursor: 'default',
                  }}>
                    Going ✓
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingRsvp(event)}
                    style={{
                      padding: '8px 14px', borderRadius: 999, border: 'none',
                      background: `var(--indigo)`,
                      color: 'var(--on-ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: 'none',
                    }}
                  >
                    RSVP
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
