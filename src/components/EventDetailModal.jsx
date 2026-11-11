import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { getEvent, markAttendance, listEventAttendeesWithStatus } from '../lib/events'
import { avatarFor } from '../lib/avatar'
import { useCalendar } from '../hooks/useCalendar.js'
import { buildMapsUrl } from '../lib/geocoding'
import { useAppContext } from '../context/AppContext.jsx'
import EventEditModal from './EventEditModal.jsx'
import { listProfilesByIds } from '../lib/profiles'
import { eventShareUrl, shareLink } from '../lib/share.js'
import { Share as ShareIcon } from 'lucide-react'

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

// Hooks must run unconditionally (L1), so the null check lives in a thin
// wrapper and the body below always has an event.
export default function EventDetailModal(props) {
  if (!props.event) return null
  // Rendered at <body> so no transformed/animated ancestor can trap it.
  return createPortal(<EventDetailModalBody {...props} />, document.body)
}

function EventDetailModalBody({ event: eventProp, onClose, closing, isRsvpd, onRsvp, onCancelRsvp }) {

  const rsvpd = isRsvpd?.(eventProp.id) ?? false

  const { currentUser, refreshMeetups } = useAppContext()
  const [currentEvent, setCurrentEvent] = useState(eventProp)
  // Everything renders from the latest copy, so an edit shows immediately.
  const event = currentEvent || eventProp
  const [showEditModal, setShowEditModal] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const [organizer, setOrganizer] = useState(null)
  const [hydratedAttendees, setHydratedAttendees] = useState(null)
  const [hydratedAttendeesCount, setHydratedAttendeesCount] = useState(null)
  const [addedToCalendar, setAddedToCalendar] = useState(false)
  const [attendanceList, setAttendanceList] = useState(null)
  const [attendanceError, setAttendanceError] = useState('')
  const [calendarBusy, setCalendarBusy] = useState(false)
  const { isConnected, addEventToGoogle, isInGoogle, connect } = useCalendar()
  // Close only once the RSVP went through; on failure stay and say so.
  const [rsvpBusy, setRsvpBusy] = useState(false)
  const [rsvpError, setRsvpError] = useState('')
  const runRsvp = async (fn, failMsg) => {
    setRsvpBusy(true)
    setRsvpError('')
    try {
      await fn()
      onClose()
    } catch (err) {
      console.error('[EventDetailModal] RSVP failed', err)
      setRsvpError(failMsg)
    } finally {
      setRsvpBusy(false)
    }
  }

  const eventDate = currentEvent?.dateObj || (currentEvent?.startsAt ? new Date(currentEvent.startsAt) : (currentEvent?.starts_at ? new Date(currentEvent.starts_at) : null))
  const isPastEvent = eventDate ? eventDate.getTime() <= Date.now() : false
  const isHost = (currentEvent?.createdBy || currentEvent?.created_by) === currentUser?.id

  useEffect(() => {
    setCurrentEvent(eventProp)
  }, [eventProp])

  // Show "Added" if this event is already on Google Calendar, so reopening the
  // sheet doesn't invite a second copy.
  useEffect(() => {
    setAddedToCalendar(false)
    if (!isConnected || !event?.id || event.source === 'google') return
    let cancelled = false
    isInGoogle(event).then(found => { if (!cancelled && found) setAddedToCalendar(true) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, isConnected])

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
  
  // "Hosted by" is whoever created the event, not the circle's organizer (L7).
  useEffect(() => {
    let cancelled = false
    if (event?.createdBy) {
      listProfilesByIds([event.createdBy]).then(([p]) => {
        if (!cancelled && p) setOrganizer({ ...p, role: 'Host' })
      }).catch(err => console.error('[EventDetailModal] host lookup failed', err))
    }
    return () => { cancelled = true }
  }, [event?.createdBy])

  useEffect(() => {
    if (!isPastEvent || !isHost || !currentEvent?.id) return
    let cancelled = false
    listEventAttendeesWithStatus(currentEvent.id)
      .then(list => { if (!cancelled) setAttendanceList(list) })
      .catch(err => console.error('[EventDetailModal] listEventAttendeesWithStatus failed', err))
    return () => { cancelled = true }
  }, [isPastEvent, isHost, currentEvent?.id])

  const handleToggleAttendance = async (attendeeId, newAttended) => {
    setAttendanceError('')
    const prev = attendanceList
    setAttendanceList(list => (list || []).map(a => a.id === attendeeId ? { ...a, attended: newAttended } : a))
    try {
      await markAttendance({ eventId: currentEvent.id, userId: attendeeId, attended: newAttended })
    } catch (err) {
      console.error('[EventDetailModal] markAttendance failed', err)
      setAttendanceList(prev)
      const rawMsg = String(err?.message || '')
      if (rawMsg.includes('Only the event host')) {
        setAttendanceError('Only the event host can mark attendance.')
      } else if (rawMsg.includes('not RSVPd')) {
        setAttendanceError('That person has not RSVPd to this event.')
      } else {
        setAttendanceError(rawMsg || 'Could not update attendance. Please try again.')
      }
    }
  }

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
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '8px 20px calc(24px + env(safe-area-inset-bottom))',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.12)',
          animation: closing ? 'tsSheetDown 0.24s ease-in forwards' : 'tsSheetUp 0.34s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: 'var(--surface-3)', margin: '0 auto 14px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: clr.textMid,
              display: 'block', marginBottom: 4,
            }}>
              {event.circleName || (event.source === 'google' ? 'Google Calendar' : 'Meetup')}
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: clr.textDark, margin: 0, lineHeight: 1.25 }}>
              {event.title}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flexShrink: 0 }}>
            {/* Share a link with a rich preview (Messages shows a card). */}
            {event.source !== 'google' && event.id && (
              <button
                type="button"
                aria-label="Share event"
                onClick={async () => {
                  const res = await shareLink({
                    url: eventShareUrl(event.id),
                    title: event.title,
                    text: `${event.title} · ${displayDate}`,
                  })
                  if (res === 'copied') { setShareNote('Link copied'); setTimeout(() => setShareNote(''), 2000) }
                }}
                style={{
                  width: 36, height: 34, borderRadius: 10, border: 'none', backgroundColor: 'var(--surface-2)',
                  color: clr.textDark, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ShareIcon size={17} strokeWidth={2.2} />
              </button>
            )}
            {currentEvent.createdBy === currentUser?.id && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 10, border: 'none',
                  backgroundColor: 'var(--surface-2)', color: clr.textDark,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Edit
              </button>
            )}
            <button type="button" onClick={onClose} style={{
              background: clr.bg, border: 'none', width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}>
              <svg width="18" height="18" fill="none" stroke={clr.textDark} strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {shareNote && <p role="status" style={{ margin: '-6px 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>{shareNote}</p>}

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
          {event.location && (() => {
            const url = buildMapsUrl({
              lat: event.locationLat, lng: event.locationLng,
              name: event.location, address: event.locationAddress,
            })
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  textDecoration: 'none',
                }}
              >
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: 0 }}>Location</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.location}
                    {event.locationAddress ? ` · ${event.locationAddress.split(',').slice(0, 2).join(',')}` : ''}
                  </p>
                </div>
                <svg width="18" height="18" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path d="M7 17L17 7M17 7H8M17 7v9" />
                </svg>
              </a>
            )
          })()}

          {/* Organizer */}
          {organizer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={avatarFor(organizer)}
                alt={organizer.name}
                style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: 0 }}>Hosted by</p>
                <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{organizer.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Host Attendance Section */}
        {isPastEvent && isHost && (
          <div style={{
            marginBottom: 22, padding: 16, backgroundColor: clr.indigoLt,
            borderRadius: 16, border: `1.5px solid ${clr.indigo}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: clr.indigo, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attendance Tracking
              </h4>
              <span style={{ fontSize: 13, fontWeight: 700, color: clr.textDark }}>
                {attendanceList ? attendanceList.filter(a => a.attended === true).length : 0} of {attendanceList ? attendanceList.length : 0} came
              </span>
            </div>

            {attendanceError && (
              <div style={{ padding: 8, backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                {attendanceError}
              </div>
            )}

            {attendanceList && attendanceList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attendanceList.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: clr.white, borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={avatarFor(a)} alt={a.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: clr.textDark }}>{a.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleAttendance(a.id, true)}
                        style={{
                          padding: '6px 12px', borderRadius: 999, border: 'none',
                          backgroundColor: a.attended === true ? '#22C55E' : clr.bg,
                          color: a.attended === true ? '#FFFFFF' : clr.textMid,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                      >
                        ✓ Came
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAttendance(a.id, false)}
                        style={{
                          padding: '6px 12px', borderRadius: 999, border: 'none',
                          backgroundColor: a.attended === false ? '#EF4444' : clr.bg,
                          color: a.attended === false ? '#FFFFFF' : clr.textMid,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                      >
                        ✕ No-show
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>No attendees found to mark.</p>
            )}
          </div>
        )}

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

        {/* RSVP / Cancel buttons (not for events that already happened) */}
        {rsvpError && (
          <p role="alert" style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>{rsvpError}</p>
        )}
        {event.source !== 'google' && !isPastEvent && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {rsvpd ? (
              <button type="button" disabled={rsvpBusy} onClick={() => runRsvp(() => onCancelRsvp?.(event.id), "Couldn't cancel your RSVP. Try again.")} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: '#FEE2E2', color: '#DC2626',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}>
                ✕ Cancel RSVP
              </button>
            ) : (
              <button type="button" disabled={rsvpBusy} onClick={() => runRsvp(() => onRsvp?.(event), "Couldn't RSVP. Try again.")} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: `var(--indigo)`,
                color: 'var(--on-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: 'none',
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
            <button type="button" disabled={calendarBusy} onClick={async () => {
              if (calendarBusy) return
              setCalendarBusy(true)
              try {
                await addEventToGoogle(event)
                setAddedToCalendar(true)
              } catch (err) {
                console.error('[EventDetailModal] addEventToGoogle failed', err)
              } finally {
                setCalendarBusy(false)
              }
            }} style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              background: `var(--indigo)`, color: 'var(--on-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: 'none', marginBottom: 12, opacity: calendarBusy ? 0.6 : 1,
            }}>
              {calendarBusy ? 'Adding…' : 'Add to Calendar'}
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
      {showEditModal && (
        <EventEditModal
          event={currentEvent}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => {
            try {
              const updated = await getEvent(currentEvent.id)
              if (updated) setCurrentEvent({ ...updated, source: currentEvent.source })
            } catch (err) {
              console.error('[EventDetailModal] refresh failed', err)
            }
            refreshMeetups?.()
          }}
          onDeleted={() => {
            refreshMeetups?.()
            setShowEditModal(false)
            onClose()
          }}
        />
      )}
    </div>
  )
}
