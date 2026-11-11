import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { listPastEventsForUser } from '../lib/events'
import { avatarFor } from '../lib/avatar'
import EventRecapModal from '../components/EventRecapModal.jsx'
import { canGoBack } from '../lib/tabActive.js'
import { Camera, Calendar, MapPin } from 'lucide-react'
import { NavBar } from '../components/ui/ds.jsx'
import { SkeletonRows } from '../components/ui/Skeleton.jsx'

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

// `embedded`: shown inside the Circles tab, so no back button or page title.
export default function Memories({ embedded = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAppContext()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const backTo = location.state?.from || '/schedule'


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
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {!embedded && <NavBar onBack={() => (canGoBack() ? navigate(-1) : navigate(backTo))} title="Memories" />}
      <div style={{ padding: embedded ? '0 0 24px' : '16px 16px 24px' }}>
      {loading ? (
        <SkeletonRows count={3} avatar={0} />
      ) : events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', backgroundColor: clr.white,
          borderRadius: 24, border: `1.5px solid ${clr.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <Camera size={48} color={clr.indigo} style={{ marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800, color: clr.textDark }}>No past memories yet</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 14, color: clr.textMid, lineHeight: 1.5 }}>
            Events you attend will appear here so you can view photos, see who came, and send thanks.
          </p>
          <button
            type="button"
            onClick={() => navigate('/schedule')}
            style={{
              padding: '12px 24px', borderRadius: 999, border: 'none',
              backgroundColor: clr.indigo, color: 'var(--on-ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
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
                border: `1px solid ${clr.border}`, boxShadow: '0 0 0 1px var(--border)',
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
                    background: 'var(--surface-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Calendar size={40} color="var(--textLight)" />
                  </div>
                )}
                {e.circleName && (
                  <span style={{
                    position: 'absolute', top: 12, left: 12,
                    // Always a light chip over the photo, so the text is
                    // always dark (--indigo turns near-white in dark mode).
                    fontSize: 11, fontWeight: 800, color: '#0B0B0C',
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
                <p style={{ margin: '0 0 14px 0', fontSize: 13, color: clr.textMid, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <Calendar size={13} color="currentColor" /> {e.dateLabel || e.date} {e.timeLabel ? `• ${e.timeLabel}` : ''} {e.location ? <>• <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={13} color="currentColor" /> {e.location}</span></> : ''}
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
    </div>
  )
}
