import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { listPastEventsForUser } from '../lib/events'
import { avatarFor } from '../lib/avatar'
import EventRecapModal from '../components/EventRecapModal.jsx'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

export default function Memories() {
  const navigate = useNavigate()
  const { currentUser } = useAppContext()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    if (!currentUser?.id) return
    let cancelled = false
    setLoading(true)
    listPastEventsForUser(currentUser.id)
      .then(list => {
        if (!cancelled) setEvents(list)
      })
      .catch(err => console.error('[Memories] listPastEventsForUser failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [currentUser?.id])

  return (
    <div style={{ padding: '24px 20px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 26, fontWeight: 800, color: clr.textDark, fontFamily: "'DM Serif Display', serif" }}>
            Event Memories
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: clr.textMid }}>
            Look back at past meetups, photos, and connections.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: clr.textMid, fontSize: 14 }}>
          Loading memories…
        </div>
      ) : events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', backgroundColor: clr.white,
          borderRadius: 24, border: `1.5px solid ${clr.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800, color: clr.textDark }}>No past memories yet</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 14, color: clr.textMid, lineHeight: 1.5 }}>
            Events you attend will appear here so you can view photos, see who came, and send thanks.
          </p>
          <button
            type="button"
            onClick={() => navigate('/schedule')}
            style={{
              padding: '12px 24px', borderRadius: 999, border: 'none',
              backgroundColor: clr.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Explore Upcoming Events →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {events.map(e => (
            <div
              key={e.id}
              onClick={() => setSelectedEvent(e)}
              style={{
                backgroundColor: clr.white, borderRadius: 20, overflow: 'hidden',
                border: `1px solid ${clr.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                cursor: 'pointer', transition: 'transform 0.15s ease',
              }}
            >
              {/* Cover Image or Gradient */}
              <div style={{ position: 'relative', height: 140, backgroundColor: clr.indigoLt }}>
                {e.coverImageUrl ? (
                  <img src={e.coverImageUrl} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
                  }}>
                    📅
                  </div>
                )}
                {e.circleName && (
                  <span style={{
                    position: 'absolute', top: 12, left: 12,
                    fontSize: 11, fontWeight: 800, color: clr.indigo,
                    backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 10px',
                    borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {e.circleName}
                  </span>
                )}
              </div>

              {/* Details */}
              <div style={{ padding: '16px 20px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 800, color: clr.textDark }}>
                  {e.title}
                </h3>
                <p style={{ margin: '0 0 14px 0', fontSize: 13, color: clr.textMid }}>
                  📅 {e.date} {e.time ? `• ${e.time}` : ''} {e.location ? `• 📍 ${e.location}` : ''}
                </p>

                {/* Overlapping attendee avatars */}
                {e.attendees && e.attendees.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {e.attendees.slice(0, 5).map((a, i) => (
                        <img
                          key={i}
                          src={avatarFor(typeof a === 'string' ? { name: a } : a)}
                          alt={a.name || 'Attendee'}
                          style={{
                            width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
                            border: '2px solid #FFFFFF', marginLeft: i > 0 ? -8 : 0,
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: clr.textMid }}>
                      {e.attendees.length} attended
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEvent && (
        <EventRecapModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
