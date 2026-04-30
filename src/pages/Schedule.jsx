import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCircles } from '../lib/circles'
import { useAppContext } from '../context/AppContext.jsx'
import { useCalendar } from '../hooks/useCalendar.js'
import EventDetailModal from '../components/EventDetailModal.jsx'
import TimePicker from '../components/TimePicker.jsx'

// Color system
const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  teal:     '#0D9488',
  amber:    '#F59E0B',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
}

// Date helpers
function getWeekDays(offset = 0) {
  const today  = new Date()
  const day    = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
}

function parseEventDate(event) {
  if (event.start?.dateTime) return new Date(event.start.dateTime)
  if (event.start?.date)     return new Date(event.start.date)
  if (event.date) {
    const safeStr = event.date.includes('-') && !event.date.includes('T') ? event.date.replace(/-/g, '/') : event.date
    return new Date(safeStr)
  }
  return null
}

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString([], { 
    hour: '2-digit', minute: '2-digit' 
  })
}



function MeetupCard({ meetup, onAddToGoogle, isConnected, onViewDetails }) {
  const [added, setAdded] = useState(false)

  const handleAdd = async (e) => {
    e.stopPropagation()
    if (added || !isConnected) return
    await onAddToGoogle()
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div
      onClick={() => onViewDetails(meetup)}
      style={{
        backgroundColor: clr.white,
        borderRadius: 20,
        padding: '18px 18px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        marginBottom: 14,
        borderLeft: `4px solid ${clr.indigo}`,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: clr.indigo,
            backgroundColor: clr.indigoLt, padding: '4px 10px',
            borderRadius: 999, letterSpacing: '0.06em',
            textTransform: 'uppercase', display: 'inline-block',
            marginBottom: 8,
          }}>
            {meetup.circleName || 'Meetup'}
          </span>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 6px 0', lineHeight: 1.3 }}>
            {meetup.title}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ fontSize: 13, color: clr.textMid }}>
                {meetup.date} • {meetup.time}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize: 13, color: clr.textMid }}>{meetup.location}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {isConnected && (
          <button type="button" onClick={handleAdd} disabled={added} style={{
            flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
            background: added ? '#DCFCE7' : clr.bg,
            color: added ? '#059669' : clr.textDark,
            fontSize: 13, fontWeight: 600, cursor: added ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
          }}>
            {added ? '✓ Added' : 'Add to Calendar'}
          </button>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onViewDetails(meetup); }} style={{
          flex: 1, padding: '10px 0', borderRadius: 12,
          border: `1.5px solid ${clr.border}`,
          backgroundColor: clr.white,
          color: clr.textDark, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Details
        </button>
      </div>
    </div>
  )
}

export default function Schedule() {
  const navigate = useNavigate()
  const [calView, setCalView] = useState('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(new Date())
  
  const [showForm, setShowForm] = useState(false)
  const [formClosing, setFormClosing] = useState(false)
  const [addToGCal, setAddToGCal] = useState(false)

  // Event detail modal state
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [detailClosing, setDetailClosing] = useState(false)

  const openEventDetail = (event) => setSelectedEvent(event)
  const closeEventDetail = () => {
    setDetailClosing(true)
    setTimeout(() => {
      setSelectedEvent(null)
      setDetailClosing(false)
    }, 300)
  }

  const [circles, setCircles] = useState([])
  useEffect(() => {
    let cancelled = false
    listCircles().then(list => { if (!cancelled) setCircles(list) })
    return () => { cancelled = true }
  }, [])

  const {
    isConfigured, isConnected, isLoading, googleEvents,
    connect, disconnect, addEventToGoogle,
  } = useCalendar()

  const { meetups, createEventAndRsvp, joinedCircles, rsvpEvent, cancelRsvp, isRsvpd, currentUser } = useAppContext()

  const [form, setForm] = useState({
    title: '', circleId: '',
    date: '', time: '', location: '', notes: '',
  })

  // Calendar events
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const today = new Date(); today.setHours(0,0,0,0)

  const allCalendarEvents = useMemo(() => {
    const tsEvents = meetups.map(m => ({
      ...m,
      source: 'thirdspace',
      color: clr.indigo,
      dateObj: m.dateObj || parseEventDate(m),
    }))

    const gcEvents = googleEvents.map(e => ({
      id: e.id,
      title: e.summary ?? 'Busy',
      source: 'google',
      color: '#34A853',
      dateObj: parseEventDate(e),
      time: e.start?.dateTime ? formatTime(new Date(e.start.dateTime)) : 'All day',
      location: e.location ?? '',
    }))

    return [...tsEvents, ...gcEvents]
  }, [meetups, googleEvents])

  const selectedDayEvents = useMemo(() => {
    return allCalendarEvents.filter(e => e.dateObj && isSameDay(e.dateObj, selectedDay))
  }, [allCalendarEvents, selectedDay])

  // Form handling
  const joinedCircleOptions = circles.filter((c) => joinedCircles.includes(c.id))

  const handleCloseForm = () => {
    setFormClosing(true)
    setTimeout(() => {
      setShowForm(false)
      setFormClosing(false)
    }, 300)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.circleId || !form.date || !form.time) return

    try {
      const event = await createEventAndRsvp({
        circleId: form.circleId,
        title: form.title,
        date: form.date,
        time: form.time,
        location: form.location,
        notes: form.notes,
      })

      if (addToGCal && isConnected) {
        await addEventToGoogle(event)
      }

      setForm({ title:'', circleId: joinedCircles[0] ?? '', date:'', time:'', location:'', notes:'' })
      setAddToGCal(false)
      handleCloseForm()
    } catch (err) {
      console.error('[Schedule] create event failed', err)
      alert('Sorry — something went wrong creating your event. Please try again.')
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '13px 16px', borderRadius: 12,
    border: `1.5px solid ${clr.border}`,
    backgroundColor: 'var(--bg, #F0F0F5)',
    fontSize: 15, color: clr.textDark,
    outline: 'none', fontFamily: 'inherit',
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: clr.textMid, letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: clr.bg,
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      paddingBottom: 100,
    }}>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, margin: 0, padding: '16px 20px 0', letterSpacing: '-0.02em', fontFamily: "'DM Serif Display', 'Georgia', serif", textAlign: 'center' }}>
        Schedule
      </h1>

      <div style={{ padding: '16px 20px 0', margin: '0 auto' }}>
        {/* SECTION A: Google Calendar Connection Bar */}
        <div style={{
          backgroundColor: isConnected ? '#F0FFF4' : clr.white,
          border: `1px solid ${isConnected ? '#86EFAC' : clr.border}`,
          borderRadius: 16, padding: '12px 16px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: isConnected ? '#DCFCE7' : clr.bg,
              display: 'flex', alignItems: 'center', 
              justifyContent: 'center', fontSize: 16,
            }}>
              📅
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: isConnected ? '#064E3B' : clr.textDark, margin: 0 }}>
                {isConnected ? 'Google Calendar Connected' : 'Connect Google Calendar'}
              </p>
              <p style={{ fontSize: 11, color: isConnected ? '#059669' : clr.textMid, margin: 0 }}>
                {isConnected ? 'Your events are syncing' : 'See all your events in one place'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={isConnected ? disconnect : connect}
            disabled={isLoading || !isConfigured}
            title={!isConfigured ? 'Add your Google Client ID to .env to enable' : undefined}
            style={{
              padding: '8px 16px', borderRadius: 999,
              border: isConnected ? `1.5px solid #86EFAC` : 'none',
              background: isConnected ? 'transparent' : (!isConfigured ? clr.textLight : `linear-gradient(135deg, #5B5FEF, #7B6FFF)`),
              color: isConnected ? '#059669' : '#FFFFFF',
              fontSize: 12, fontWeight: 700,
              cursor: (isLoading || !isConfigured) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !isConfigured) ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        {/* SECTION B: Calendar View Toggle + Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ 
            display: 'flex', gap: 4, backgroundColor: clr.border,
            borderRadius: 999, padding: 4,
          }}>
            {['day','week','month'].map(v => (
              <button key={v} onClick={() => setCalView(v)} style={{
                padding: '6px 14px', borderRadius: 999, border: 'none',
                backgroundColor: calView === v ? clr.white : 'transparent',
                color: calView === v ? clr.textDark : clr.textMid,
                fontSize: 13, fontWeight: calView === v ? 700 : 500,
                cursor: 'pointer',
                boxShadow: calView === v ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                textTransform: 'capitalize',
              }}>
                {v}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{
              width:32, height:32, borderRadius:'50%', border:'none',
              backgroundColor: clr.white, boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="14" height="14" fill="none" stroke={clr.textMid} strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button onClick={() => setWeekOffset(0)} style={{
              fontSize: 12, fontWeight: 600, color: clr.indigo,
              background:'none', border:'none', cursor:'pointer',
            }}>
              Today
            </button>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{
              width:32, height:32, borderRadius:'50%', border:'none',
              backgroundColor: clr.white, boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="14" height="14" fill="none" stroke={clr.textMid} strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* SECTION C: Week view calendar grid */}
        <div style={{
          backgroundColor: clr.white, borderRadius: 20,
          overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          marginBottom: 24,
        }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${clr.border}`,
          }}>
            {weekDays.map(day => {
              const isToday = isSameDay(day, today)
              const isSelected = isSameDay(day, selectedDay)
              return (
                <button key={day.toISOString()} onClick={() => setSelectedDay(day)} style={{
                  padding: '12px 4px', border: 'none', backgroundColor: 'transparent',
                  cursor: 'pointer', textAlign: 'center',
                  borderBottom: isSelected ? `2px solid ${clr.indigo}` : '2px solid transparent',
                }}>
                  <p style={{
                    fontSize: 10, fontWeight: 600, color: clr.textLight, margin: '0 0 4px 0',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: isToday ? clr.indigo : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? '#FFFFFF' : clr.textDark }}>
                      {day.getDate()}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 80, padding: '8px 0' }}>
            {weekDays.map(day => {
              const dayEvents = allCalendarEvents.filter(e => e.dateObj && isSameDay(e.dateObj, day))
              return (
                <div key={day.toISOString()} style={{ padding: '0 3px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {dayEvents.slice(0, 3).map(event => (
                    <div key={event.id} onClick={(e) => { e.stopPropagation(); setSelectedDay(day); openEventDetail(event); }} style={{
                      backgroundColor: event.color,
                      borderRadius: 4, padding: '2px 5px',
                      fontSize: 9, fontWeight: 600, color: '#FFFFFF', lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}>
                      {event.time ?? event.start?.dateTime ? formatTime(event.dateObj) + ' ' : ''}
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 9, color: clr.textLight, paddingLeft: 3 }}>
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION D: Selected Day Detail */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, margin: '0 0 12px 0' }}>
            {isSameDay(selectedDay, today) ? 'Today' : selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>

          {selectedDayEvents.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px', backgroundColor: clr.white,
              borderRadius: 16, color: clr.textLight, fontSize: 13,
            }}>
              Nothing scheduled — 
              <button onClick={() => setShowForm(true)} style={{
                background: 'none', border: 'none', color: clr.indigo, fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>
                 add a meetup?
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {selectedDayEvents
                .sort((a,b) => (a.dateObj ?? 0) - (b.dateObj ?? 0))
                .map(event => (
                  <div key={event.id} onClick={() => openEventDetail(event)} style={{
                    backgroundColor: clr.white, borderRadius: 16, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    borderLeft: `4px solid ${event.color}`,
                    cursor: 'pointer', transition: 'box-shadow 0.15s ease',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: '0 0 3px 0' }}>
                        {event.title}
                      </p>
                      <p style={{ fontSize: 12, color: clr.textMid, margin: 0 }}>
                        {event.dateObj ? formatTime(event.dateObj) : event.time}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      backgroundColor: event.source === 'thirdspace' ? clr.indigoLt : '#F0FFF4',
                      color: event.source === 'thirdspace' ? clr.indigo : '#059669',
                      padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase',
                      letterSpacing: '0.06em', flexShrink: 0,
                    }}>
                      {event.source === 'thirdspace' ? '3S' : 'GCal'}
                    </span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* SECTION E: Your RSVP'd Events */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: 0 }}>
              Your Meetups
            </h2>
            <button onClick={() => setShowForm(true)} style={{
              padding: '12px 24px', borderRadius: 999, border: 'none',
              background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
              color: '#FFFFFF', fontSize: 15, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(91,95,239,0.35)',
            }}>
              + New Meetup
            </button>
          </div>

          {meetups.length === 0 ? (
            <p style={{ fontSize:14, color: clr.textMid }}>
              Once you RSVP to events or create your own, they'll land here.
            </p>
          ) : (
            meetups.map(meetup => (
              <MeetupCard 
                key={meetup.id} 
                meetup={meetup}
                onAddToGoogle={() => addEventToGoogle(meetup)}
                isConnected={isConnected}
                onViewDetails={openEventDetail}
              />
            ))
          )}
        </div>
      </div>

      {/* SECTION F: Propose a Meetup form Bottom Sheet */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          alignItems: 'center',
          animation: formClosing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease forwards',
        }}>
          <div style={{
            backgroundColor: clr.white,
            width: '100%', maxWidth: 500,
            borderTopLeftRadius: 32, borderTopRightRadius: 32,
            padding: '32px 24px', height: '85vh',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
            overflowY: 'auto',
            animation: formClosing ? 'slideDown 0.3s ease forwards' : 'slideUp 0.3s ease forwards',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:0 }}>Propose a Meetup</h2>
              <button type="button" onClick={handleCloseForm} style={{
                background: clr.border, border:'none', width:36, height:36, borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
              }}>
                <svg width="20" height="20" fill="none" stroke={clr.textDark} strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16, paddingBottom: 60 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="What's the plan?" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>

              <div>
                <label style={labelStyle}>Select Circle</label>
                <div style={{ position:'relative' }}>
                  <select value={form.circleId}
                    onChange={e => setForm(f => ({ ...f, circleId: e.target.value }))}
                    style={{ ...inputStyle, appearance:'none', paddingRight:40, cursor:'pointer' }}
                  >
                    <option value="" disabled>Select a circle...</option>
                    {joinedCircleOptions.length === 0
                      ? <option value="" disabled>Join a circle to schedule</option>
                      : joinedCircleOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                    }
                  </select>
                  <svg width="16" height="16" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24"
                    style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  onClick={(e) => { try { e.target.showPicker() } catch(err){} }}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Time</label>
                <TimePicker 
                  value={form.time} 
                  onChange={t => setForm(f => ({ ...f, time: t }))} 
                />
              </div>

              <div>
                <label style={labelStyle}>Location</label>
                <div style={{ position:'relative' }}>
                  <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24"
                    style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <input type="text" value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Where are we meeting?" style={{ ...inputStyle, paddingLeft:40 }}
                    onFocus={e => e.target.style.borderColor = clr.indigo}
                    onBlur={e  => e.target.style.borderColor = clr.border}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea rows={4} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any specific details or requirements?"
                  style={{ ...inputStyle, resize:'none', lineHeight:1.6 }}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>

              {/* Add to Google Calendar Toggle */}
              {isConnected && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: '12px 16px', backgroundColor: clr.bg, borderRadius: 12, border: `1.5px solid ${clr.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📅</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: clr.textDark }}>Sync to Google Calendar</span>
                  </div>
                  <button type="button" onClick={() => setAddToGCal(!addToGCal)} style={{
                    width: 44, height: 24, borderRadius: 999, border: 'none',
                    backgroundColor: addToGCal ? clr.indigo : clr.textLight,
                    position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: addToGCal ? 22 : 2, width: 20, height: 20,
                      borderRadius: '50%', backgroundColor: clr.white, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              )}

              <button type="submit"
                disabled={!form.title || !form.circleId || !form.date || !form.time}
                style={{
                  width:'100%', padding:'15px 0', borderRadius:14, border:'none', marginTop: 10,
                  background: (!form.title || !form.circleId || !form.date || !form.time)
                    ? clr.textLight : `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
                  color:'#FFFFFF', fontSize:16, fontWeight:700,
                  cursor: (!form.title || !form.circleId || !form.date || !form.time) ? 'not-allowed' : 'pointer',
                  boxShadow: (!form.title || !form.circleId || !form.date || !form.time) ? 'none' : '0 6px 20px rgba(91,95,239,0.38)',
                  transition:'all 0.2s ease',
                }}>
                Create Meetup
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={closeEventDetail}
          closing={detailClosing}
          isRsvpd={isRsvpd}
          onRsvp={(evt) => rsvpEvent(evt)}
          onCancelRsvp={(evtId) => cancelRsvp(evtId)}
        />
      )}



      {/* Styles for animation */}
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
