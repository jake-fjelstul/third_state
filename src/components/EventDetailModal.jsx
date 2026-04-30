import { useState, useEffect } from 'react'
import { getCircle } from '../lib/circles'
import { getEvent } from '../lib/events'
import { avatarFor } from '../lib/avatar'
import { useCalendar } from '../hooks/useCalendar.js'

const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  amber:    '#F59E0B',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
}

export default function EventDetailModal({ event, onClose, closing, isRsvpd, onRsvp, onCancelRsvp }) {
  if (!event) return null

  const rsvpd = isRsvpd?.(event.id) ?? false

  const [organizer, setOrganizer] = useState(null)
  const [hydratedAttendees, setHydratedAttendees] = useState(null)
  const [hydratedAttendeesCount, setHydratedAttendeesCount] = useState(null)
  const [addedToCalendar, setAddedToCalendar] = useState(false)
  const { isConnected, addEventToGoogle, connect } = useCalendar()

  useEffect(() => {
    setAddedToCalendar(false)
  }, [event?.id])

  useEffect(() => {
    // Only fetch if this is a real DB event (not a Google Calendar item).
    if (!event?.id || event.source === 'google') {
      setHydratedAttendees(null)
      setHydratedAttendeesCount(null)
      return
    }
    let cancelled = false
    getEvent(event.id)
      .then(full => {
        if (cancelled || !full) return
        setHydratedAttendees(full.attendees)
        setHydratedAttendeesCount(full.attendeesCount)
      })
      .catch(err => console.error('[EventDetailModal] getEvent failed', err))
    return () => { cancelled = true }
  }, [event?.id, event?.source])
  
  useEffect(() => {
    let cancelled = false
    if (event?.circleId) {
      getCircle(event.circleId).then(c => {
        if (!cancelled && c?.organizer) setOrganizer(c.organizer)
      }).catch(err => console.error('[EventDetailModal] getCircle failed', err))
    }
    return () => { cancelled = true }
  }, [event?.circleId])

  // Attendees
  const attendees = hydratedAttendees ?? event.attendees ?? []
  const attendeesCount = hydratedAttendeesCount ?? event.attendeesCount ?? attendees.length

  // Format time nicely
  const displayTime = event.dateObj
    ? event.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : event.time ?? ''
  const displayDate = event.dateObj
    ? event.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : event.date ?? ''

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1100,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        animation: closing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: clr.white,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: '28px 24px 36px',
          maxHeight: '75vh', overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.12)',
          animation: closing ? 'slideDown 0.3s ease forwards' : 'slideUp 0.3s ease forwards',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: clr.border, margin: '0 auto 18px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: event.source === 'google' ? '#059669' : clr.indigo,
              backgroundColor: event.source === 'google' ? '#F0FFF4' : clr.indigoLt,
              padding: '4px 10px', borderRadius: 999,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              display: 'inline-block', marginBottom: 10,
            }}>
              {event.circleName || (event.source === 'google' ? 'Google Calendar' : 'Meetup')}
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: clr.textDark, margin: 0, lineHeight: 1.3 }}>
              {event.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{
            background: clr.bg, border: 'none', width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 12,
          }}>
            <svg width="18" height="18" fill="none" stroke={clr.textDark} strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Info rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          {/* Date & time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: clr.indigoLt,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" fill="none" stroke={clr.indigo} strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: 0 }}>{displayDate}</p>
              <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{displayTime}</p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: '#FEF3C7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" fill="none" stroke={clr.amber} strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: 0 }}>Location</p>
                <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{event.location}</p>
              </div>
            </div>
          )}

          {/* Organizer */}
          {organizer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={avatarFor(organizer)}
                alt={organizer.name}
                style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: 0 }}>Organizer</p>
                <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{organizer.name} · {organizer.role ?? 'Host'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Attendees */}
        {(attendees.length > 0 || attendeesCount > 0) && (
          <div style={{ marginBottom: 22 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: clr.textMid, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
              Who's Going · {attendeesCount || attendees.length}
            </h4>
            {attendees.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attendees.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src={avatarFor(typeof a === 'string' ? { name: a } : a)}
                      alt={a.name || a}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: clr.textDark }}>{a.name || a}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{attendeesCount} people attending</p>
            )}
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div style={{
            backgroundColor: clr.bg, borderRadius: 14, padding: '14px 16px', marginBottom: 22,
            border: `1px solid ${clr.border}`,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 0' }}>Notes</p>
            <p style={{ fontSize: 14, color: clr.textDark, margin: 0, lineHeight: 1.6 }}>{event.notes}</p>
          </div>
        )}

        {/* RSVP / Cancel buttons */}
        {event.source !== 'google' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {rsvpd ? (
              <button type="button" onClick={() => { onCancelRsvp?.(event.id); onClose(); }} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: '#FEE2E2', color: '#DC2626',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}>
                ✕ Cancel RSVP
              </button>
            ) : (
              <button type="button" onClick={() => { onRsvp?.(event); onClose(); }} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
                color: '#FFFFFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(91,95,239,0.35)',
                transition: 'all 0.2s ease',
              }}>
                ✓ RSVP
              </button>
            )}
          </div>
        )}

        {event.source !== 'google' && (
          !isConnected ? (
            <button type="button" onClick={connect} style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: `1.5px solid ${clr.border}`,
              background: clr.white, color: clr.textDark, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
            }}>
              Connect Google Calendar to add this event
            </button>
          ) : addedToCalendar ? (
            <div style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#DCFCE7', color: '#059669', fontSize: 14, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
              ✓ Added to your calendar
            </div>
          ) : (
            <button type="button" onClick={async () => {
              try {
                await addEventToGoogle(event)
                setAddedToCalendar(true)
              } catch (err) {
                console.error('[EventDetailModal] addEventToGoogle failed', err)
              }
            }} style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`, color: '#FFFFFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(91,95,239,0.35)', marginBottom: 12,
            }}>
              Add to Calendar
            </button>
          )
        )}

        {/* Close button */}
        <button type="button" onClick={onClose} style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: `1.5px solid ${clr.border}`,
          background: clr.white,
          color: clr.textDark, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Close
        </button>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideDown {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
