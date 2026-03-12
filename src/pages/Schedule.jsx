import { useMemo, useState } from 'react'
import { circles } from '../data/mockData'
import { useAppContext } from '../context/AppContext.jsx'
 
const clr = {
  bg:       '#F0F0F5',
  white:    '#FFFFFF',
  indigo:   '#5B5FEF',
  indigoLt: '#EEEEFF',
  textDark: '#1A1A2E',
  textMid:  '#6B7280',
  textLight:'#9CA3AF',
  border:   '#E8E8EE',
  inputBg:  '#F7F7FB',
}
 
function getCurrentWeekDays() {
  const today = new Date()
  const day = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + idx)
    return d
  })
}
 
const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
 
const MONTH_NAMES = [
  'JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER',
]
 
export default function Schedule() {
  const { joinedCircles, meetups, addMeetup } = useAppContext()
  const [form, setForm] = useState({
    title: '', circleId: joinedCircles[0] ?? '',
    date: '', time: '', location: '', notes: '',
  })
 
  const joinedCircleOptions = circles.filter((c) => joinedCircles.includes(c.id))
  const weekDays = useMemo(() => getCurrentWeekDays(), [])
  const today = new Date(); today.setHours(0,0,0,0)
 
  const meetupsByDate = useMemo(() => {
    const map = new Map()
    meetups.forEach((m) => map.set(m.date, [...(map.get(m.date) ?? []), m]))
    return map
  }, [meetups])
 
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title || !form.circleId || !form.date || !form.time) return
    const circle = circles.find((c) => c.id === form.circleId)
    addMeetup({
      id: `custom-${Date.now()}`,
      title: form.title,
      circleId: form.circleId,
      circleName: circle?.name ?? 'Circle',
      date: form.date, time: form.time,
      location: form.location || 'TBD',
      notes: form.notes,
      attendees: [],
    })
    setForm((p) => ({ ...p, title:'', date:'', time:'', location:'', notes:'' }))
  }
 
  const monthLabel = `${MONTH_NAMES[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
 
  /* shared input style */
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '13px 16px',
    borderRadius: 12,
    border: `1.5px solid ${clr.border}`,
    backgroundColor: clr.inputBg,
    fontSize: 15, color: clr.textDark,
    outline: 'none', fontFamily: 'inherit',
  }
 
  const labelStyle = {
    display: 'block',
    fontSize: 11, fontWeight: 700,
    color: clr.textMid,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 6,
  }
 
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      paddingBottom: 100,
    }}>
 
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 12px',
      }}>
        <button type="button" style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
          <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span style={{ fontSize:17, fontWeight:700, color: clr.textDark }}>Scheduling</span>
        <button type="button" style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
          <svg width="22" height="22" fill="none" stroke={clr.indigo} strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
          </svg>
        </button>
      </div>
 
      <div style={{ padding: '0 20px', maxWidth: 500, margin: '0 auto' }}>
 
        {/* ── Week strip ── */}
        <div style={{
          backgroundColor: clr.white,
          borderRadius: 20,
          padding: '18px 16px',
          marginBottom: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {/* Month header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:13, fontWeight:700, color: clr.textMid, letterSpacing:'0.08em' }}>
              {monthLabel}
            </span>
            <div style={{ display:'flex', gap:12 }}>
              {['<', '>'].map((ch) => (
                <button key={ch} type="button" style={{
                  background:'none', border:'none', cursor:'pointer',
                  fontSize:14, color: clr.textMid, padding:'2px 4px',
                }}>{ch}</button>
              ))}
            </div>
          </div>
 
          {/* Day columns */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, textAlign:'center' }}>
            {/* Day labels */}
            {DAY_LABELS.map((d) => (
              <div key={d} style={{ fontSize:10, fontWeight:700, color: clr.textLight, letterSpacing:'0.06em', marginBottom:8 }}>
                {d}
              </div>
            ))}
            {/* Day numbers */}
            {weekDays.map((day, i) => {
              const isToday = day.getTime() === today.getTime()
              const key = day.toISOString().slice(0,10)
              const hasMeetup = (meetupsByDate.get(key) ?? []).length > 0
              return (
                <div key={key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: '50%',
                    backgroundColor: isToday ? clr.indigo : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: isToday ? 700 : 500,
                      color: isToday ? '#FFFFFF' : clr.textDark,
                    }}>
                      {day.getDate()}
                    </span>
                  </div>
                  {hasMeetup && (
                    <div style={{ width:5, height:5, borderRadius:'50%', backgroundColor: clr.indigo }}/>
                  )}
                </div>
              )
            })}
          </div>
        </div>
 
        {/* ── Upcoming Meetups ── */}
        <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:'0 0 14px 0' }}>
          Upcoming Meetups
        </h2>
 
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:32 }}>
          {meetups.length === 0 ? (
            <p style={{ fontSize:14, color: clr.textMid }}>
              Once you RSVP to events or create your own, they'll land here.
            </p>
          ) : (
            meetups.map((meetup) => (
              <div key={meetup.id} style={{
                backgroundColor: clr.white,
                borderRadius: 20,
                padding: '18px 18px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                {/* Circle tag */}
                <div style={{ marginBottom:8 }}>
                  <span style={{
                    fontSize:11, fontWeight:700, color: clr.indigo,
                    backgroundColor: clr.indigoLt,
                    padding:'4px 10px', borderRadius:999,
                    letterSpacing:'0.06em', textTransform:'uppercase',
                  }}>
                    {meetup.circleName}
                  </span>
                </div>
 
                {/* Title + avatars row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <h3 style={{ fontSize:18, fontWeight:800, color: clr.textDark, margin:0, lineHeight:1.3, maxWidth:'60%' }}>
                    {meetup.title}
                  </h3>
                  {/* Avatar stack */}
                  {meetup.attendees?.length > 0 && (
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <div style={{ display:'flex' }}>
                        {meetup.attendees.slice(0,3).map((a, i) => (
                          <img key={a.name} src={a.avatar} alt={a.name} style={{
                            width:32, height:32, borderRadius:'50%',
                            objectFit:'cover',
                            border:'2px solid #FFFFFF',
                            marginLeft: i === 0 ? 0 : -10,
                          }}/>
                        ))}
                      </div>
                      {meetup.attendees.length > 3 && (
                        <div style={{
                          width:32, height:32, borderRadius:'50%',
                          backgroundColor: clr.indigoLt,
                          border:'2px solid #FFFFFF',
                          marginLeft:-10,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:700, color: clr.indigo,
                        }}>
                          +{meetup.attendees.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
 
                {/* Date + location */}
                <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <svg width="14" height="14" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span style={{ fontSize:13, color: clr.textMid }}>
                      {meetup.date} • {meetup.time}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <svg width="14" height="14" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span style={{ fontSize:13, color: clr.textMid }}>{meetup.location}</span>
                  </div>
                </div>
 
                {/* Buttons */}
                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" style={{
                    flex:1, padding:'12px 0', borderRadius:12, border:'none',
                    background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
                    color:'#FFFFFF', fontSize:14, fontWeight:600, cursor:'pointer',
                    boxShadow:'0 4px 14px rgba(91,95,239,0.35)',
                  }}>
                    Attend
                  </button>
                  <button type="button" style={{
                    flex:1, padding:'12px 0', borderRadius:12,
                    border:`1.5px solid ${clr.border}`,
                    backgroundColor: clr.white,
                    color: clr.textDark, fontSize:14, fontWeight:600, cursor:'pointer',
                  }}>
                    Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
 
        {/* ── Propose a Meetup form ── */}
        <div style={{
          backgroundColor: clr.white,
          borderRadius: 24,
          padding: '24px 20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:'0 0 20px 0' }}>
            Propose a Meetup
          </h2>
 
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
 
            {/* Title */}
            <div>
              <label style={labelStyle}>Title</label>
              <input type="text" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What's the plan?"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = clr.indigo}
                onBlur={e  => e.target.style.borderColor = clr.border}
              />
            </div>
 
            {/* Circle */}
            <div>
              <label style={labelStyle}>Select Circle</label>
              <div style={{ position:'relative' }}>
                <select value={form.circleId}
                  onChange={e => setForm(f => ({ ...f, circleId: e.target.value }))}
                  style={{ ...inputStyle, appearance:'none', paddingRight:40, cursor:'pointer' }}
                >
                  {joinedCircleOptions.length === 0
                    ? <option value="">Join a circle to schedule</option>
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
 
            {/* Date + Time */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>
              <div>
                <label style={labelStyle}>Time</label>
                <input type="time" value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>
            </div>
 
            {/* Location */}
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
                  placeholder="Where are we meeting?"
                  style={{ ...inputStyle, paddingLeft:40 }}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>
            </div>
 
            {/* Notes */}
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
 
            {/* Submit */}
            <button type="submit"
              disabled={!form.title || !form.circleId || !form.date || !form.time}
              style={{
                width:'100%', padding:'15px 0',
                borderRadius:14, border:'none',
                background: (!form.title || !form.circleId || !form.date || !form.time)
                  ? '#CBD5E1'
                  : `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
                color:'#FFFFFF', fontSize:16, fontWeight:700,
                cursor: (!form.title || !form.circleId || !form.date || !form.time) ? 'not-allowed' : 'pointer',
                boxShadow: (!form.title || !form.circleId || !form.date || !form.time)
                  ? 'none'
                  : '0 6px 20px rgba(91,95,239,0.38)',
                transition:'all 0.2s ease',
              }}>
              Create Meetup
            </button>
 
          </form>
        </div>
 
      </div>
    </div>
  )
}

