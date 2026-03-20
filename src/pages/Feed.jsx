import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { people, circles, events } from '../data/mockData'
import SwipeDiscovery from '../components/discovery/SwipeDiscovery.jsx'
import EventDetailModal from '../components/EventDetailModal.jsx'
 
const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  amber:    '#F59E0B',
  green:    'var(--green)',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
}
 
const TABS = [
  { id: 'for-you', label: 'For You'  },
  { id: 'circles', label: 'Circles'  },
  { id: 'events',  label: 'Events'   },
]
 
const CIRCLE_COLORS = [
  { bg:'#EEF0FF', accent:'#5B5FEF' },
  { bg:'#FEF3C7', accent:'#D97706' },
  { bg:'#D1FAE5', accent:'#059669' },
  { bg:'#FFE4E6', accent:'#E11D48' },
]
 
const EVENT_GRADIENTS = [
  'linear-gradient(135deg,#5B5FEF,#818CF8)',
  'linear-gradient(135deg,#0D9488,#34D399)',
  'linear-gradient(135deg,#D97706,#FCD34D)',
  'linear-gradient(135deg,#E11D48,#FB7185)',
]
 
/* ── Person card ── */
function PersonCard({ person }) {
  const navigate = useNavigate()
  const { startDM } = useAppContext()
  return (
    <div onClick={() => navigate(`/user/${person.id}`)} style={{
      flexShrink:0, width:170,
      backgroundColor: clr.white,
      borderRadius:20, padding:'16px 14px',
      boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
      display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
      cursor:'pointer'
    }}>
      <div style={{ position:'relative', marginBottom:10 }}>
        <img src={person.avatar} alt={person.name} style={{
          width:56, height:56, borderRadius:'50%', objectFit:'cover',
        }}/>
        {person.online && (
          <div style={{
            position:'absolute', bottom:2, right:2,
            width:12, height:12, borderRadius:'50%',
            backgroundColor: clr.green, border:`2px solid ${clr.white}`,
          }}/>
        )}
      </div>
      <p style={{ fontSize:14, fontWeight:700, color: clr.textDark, margin:'0 0 2px 0' }}>
        {person.name.split(' ')[0]}
        <span style={{ fontSize:12, fontWeight:400, color: clr.textLight }}> {person.age}</span>
      </p>
      <p style={{ fontSize:12, color: clr.textMid, margin:'0 0 10px 0',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>
        {person.bio?.slice(0,36)}…
      </p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'center', marginBottom:12 }}>
        {person.interests?.slice(0,2).map(i => (
          <span key={i} style={{
            fontSize:10, fontWeight:600, color: clr.indigo,
            backgroundColor: clr.indigoLt, padding:'3px 8px', borderRadius:999,
          }}>{i}</span>
        ))}
      </div>
      <button type="button" 
        onClick={() => {
          const chatId = startDM(person)
          navigate(`/chat/${chatId}`)
        }}
        style={{
        width:'100%', padding:'8px 0', borderRadius:999,
        border:`1.5px solid ${clr.indigo}`,
        backgroundColor: clr.white,
        color: clr.indigo, fontSize:12, fontWeight:700, cursor:'pointer',
      }}>
        Say Hi →
      </button>
    </div>
  )
}
 
/* ── Circle card ── */
function CircleCard({ circle, idx, isJoined, onJoin, onClick }) {
  const accent = CIRCLE_COLORS[idx % CIRCLE_COLORS.length]
  const isPrivate = circle.type === 'private'
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: clr.white, borderRadius:20,
        padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
        display:'flex', alignItems:'center', gap:12, cursor:'pointer',
        transition:'transform 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
    >
      <div style={{
        width:52, height:52, borderRadius:14, flexShrink:0,
        backgroundColor: accent.bg,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
      }}>
        {circle.emoji ?? '⭕'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
          <span style={{ fontSize:15, fontWeight:700, color: clr.textDark,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {circle.name}
          </span>
          {isPrivate && (
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:600, color: accent.accent,
            backgroundColor: accent.bg, padding:'2px 8px', borderRadius:999 }}>
            {circle.interestTag}
          </span>
          <span style={{ fontSize:11, color: clr.textLight }}>
            {circle.memberCount ?? circle.members?.length ?? 0} members
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onJoin() }}
        style={{
          flexShrink:0, padding:'8px 14px', borderRadius:999,
          border: isJoined ? 'none' : `1.5px solid ${clr.indigo}`,
          backgroundColor: isJoined ? clr.indigoLt : clr.white,
          color: clr.indigo, fontSize:12, fontWeight:700,
          cursor: isJoined ? 'default' : 'pointer',
        }}
      >
        {isJoined ? '✓' : isPrivate ? 'Request' : 'Join'}
      </button>
    </div>
  )
}
 
/* ── Event card ── */
function EventCard({ event, idx, isRsvpd, onViewDetails }) {
  const rsvpd = isRsvpd?.(event.id) ?? false
  return (
    <div onClick={() => onViewDetails?.(event)} style={{
      flexShrink:0, width:220,
      backgroundColor: clr.white,
      borderRadius:20, overflow:'hidden',
      boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
      cursor: 'pointer',
    }}>
      {/* Gradient header */}
      <div style={{
        height:72,
        background: EVENT_GRADIENTS[idx % EVENT_GRADIENTS.length],
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <span style={{ fontSize:28 }}>{event.emoji ?? '📅'}</span>
      </div>
      <div style={{ padding:'14px' }}>
        <p style={{ fontSize:14, fontWeight:700, color: clr.textDark, margin:'0 0 6px 0', lineHeight:1.3 }}>
          {event.title}
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize:12, color: clr.textMid }}>{event.date} · {event.time}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ fontSize:12, color: clr.textMid,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {event.location}
            </span>
          </div>
        </div>
        {/* Attendee stack */}
        {event.attendees?.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
            <div style={{ display:'flex' }}>
              {event.attendees.slice(0,3).map((a,i) => (
                <img key={i} src={a.avatar ?? `https://api.dicebear.com/7.x/notionists/svg?seed=${i}`} alt=""
                  style={{ width:22, height:22, borderRadius:'50%', objectFit:'cover',
                    border:`2px solid ${clr.white}`, marginLeft: i===0?0:-8 }}/>
              ))}
            </div>
            <span style={{ fontSize:11, color: clr.textLight }}>
              {event.attendees.length}+ going
            </span>
          </div>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onViewDetails?.(event); }} style={{
          width:'100%', padding:'9px 0', borderRadius:999, border:'none',
          background: rsvpd ? clr.indigoLt : `linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
          color: rsvpd ? clr.indigo : '#FFFFFF',
          fontSize:13, fontWeight:700, cursor:'pointer',
          boxShadow: rsvpd ? 'none' : '0 4px 12px rgba(91,95,239,0.3)',
          transition:'all 0.2s ease',
        }}>
          {rsvpd ? '✓ Going' : 'Details'}
        </button>
      </div>
    </div>
  )
}
 
/* ── Horizontal scroll row ── */
function HScrollRow({ children }) {
  return (
    <div style={{ overflowX:'auto', scrollbarWidth:'none', margin:'0 -16px' }}>
      <div style={{ display:'flex', gap:12, padding:'4px 16px' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Up Next Card ── */
function UpNextCard({ meetup, idx, onViewDetails }) {
  const accents = ['#5B5FEF', '#0D9488', '#F59E0B', '#E11D48']
  const accent  = accents[idx % accents.length]

  const getUrgency = (dateStr) => {
    const today    = new Date(); today.setHours(0,0,0,0)
    const safeStr  = dateStr?.includes('-') && !dateStr.includes('T') ? dateStr.replace(/-/g, '/') : dateStr
    const meetDate = new Date(safeStr); meetDate.setHours(0,0,0,0)
    const diff     = Math.round((meetDate - today) / 86400000)
    
    if (diff === 0) return { label: 'Today',       amber: true  }
    if (diff === 1) return { label: 'Tomorrow',    amber: true  }
    if (diff <= 7 && diff > 1) return { label: `In ${diff}d`, amber: false }
    
    const d = new Date(safeStr)
    return { 
      label: d.toLocaleDateString('en-US', 
        { month: 'short', day: 'numeric' }), 
      amber: false 
    }
  }

  const urgency = getUrgency(meetup.date)

  return (
    <div
      onClick={() => onViewDetails?.(meetup)}
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: clr.white,
        borderRadius: 16,
        padding: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        borderTop: `3px solid ${accent}`,
        transition: 'transform 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <span style={{
        display: 'inline-block',
        fontSize: 10, fontWeight: 700,
        backgroundColor: urgency.amber ? 'var(--orangeLt, #FEF3C7)' : clr.bg,
        color: urgency.amber ? 'var(--orange, #D97706)' : clr.textMid,
        padding: '2px 8px', borderRadius: 999,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 8,
      }}>
        {urgency.label}
      </span>
      <p style={{
        fontSize: 13, fontWeight: 700, color: clr.textDark,
        margin: '0 0 4px 0',
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {meetup.title}
      </p>
      <p style={{
        fontSize: 11, color: clr.textMid, margin: 0,
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {meetup.time} · {meetup.location}
      </p>
    </div>
  )
}


/* ── Section header ── */
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom:14 }}>
      <h2 style={{ fontSize:20, fontWeight:800, color: clr.textDark, margin:'0 0 4px 0' }}>{title}</h2>
      {subtitle && <p style={{ fontSize:13, color: clr.textMid, margin:0 }}>{subtitle}</p>}
    </div>
  )
}
 
/* ── CREATE ACTIONS ── */
const CREATE_ACTIONS = [
  {
    id: 'circle',
    label: 'New Circle',
    description: 'Start a community',
    emoji: '🔵',
    gradient: 'linear-gradient(135deg, #5B5FEF, #818CF8)',
  },
  {
    id: 'event',
    label: 'New Event',
    description: 'Host a meetup',
    emoji: '📅',
    gradient: 'linear-gradient(135deg, #0D9488, #34D399)',
  },
  {
    id: 'lfg',
    label: 'LFG',
    description: "I'm free now",
    emoji: '⚡',
    gradient: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
  },
  {
    id: 'coffee',
    label: 'Coffee Chat',
    description: '1:1 meetup',
    emoji: '☕',
    gradient: 'linear-gradient(135deg, #E11D48, #FB7185)',
  },
]

function CreateCard({ action, onClick }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        borderRadius: 20,
        border: 'none',
        background: action.gradient,
        padding: '18px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s ease',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>{action.emoji}</div>
      <p style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', margin: '0 0 3px 0' }}>{action.label}</p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>{action.description}</p>
    </button>
  )
}

function CreateModals({ show, onClose, onShowToast }) {
  const { joinedCircles, startDM, sendMessage } = useAppContext()
  const [coffeeSearch, setCoffeeSearch] = useState('')
  const [coffeeTarget, setCoffeeTarget] = useState(null)
  const [circlePrivacy, setCirclePrivacy] = useState('open')
  
  if (!show) return null

  const bottomSheetStyle = {
    position: 'fixed', inset: 0, zIndex: 300,
    backgroundColor: 'rgba(15,15,30,0.5)', display: 'flex', alignItems: 'flex-end',
  }
  const sheetContentStyle = {
    width: '100%', backgroundColor: clr.white,
    borderRadius: '24px 24px 0 0', padding: '24px 20px 48px',
    animation: 'slideUp 0.25s ease',
  }

  const Handle = () => <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}><div style={{ width:32, height:4, backgroundColor:clr.border, borderRadius:2 }} /></div>
  const Header = ({ title }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
      <h3 style={{ margin:0, fontSize:20, fontWeight:800, color:clr.textDark }}>{title}</h3>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><svg width="24" height="24" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>
  )

  const inputStyle = { width:'100%', boxSizing:'border-box', padding:'14px 16px', borderRadius:16, border:`1.5px solid ${clr.border}`, backgroundColor:clr.bg, fontSize:15, color:clr.textDark, outline:'none', fontFamily:'inherit', marginBottom:16 }
  const submitStyle = { width:'100%', padding:'16px 0', borderRadius:999, border:'none', background:`linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color:'#FFFFFF', fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(91,95,239,0.3)', marginTop:8 }

  const content = () => {
    if (show === 'circle') return (
      <form onSubmit={e => { e.preventDefault(); onClose(); onShowToast('Circle created successfully!') }}>
        <Handle /><Header title="Create a Circle" />
        <input required placeholder="Circle Name" style={inputStyle} />
        <input required placeholder="Interest / Topic (e.g. Photography)" style={inputStyle} />
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <label style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:14, borderRadius:16, border: circlePrivacy === 'open' ? `1.5px solid ${clr.indigo}` : `1.5px solid ${clr.border}`, background: circlePrivacy === 'open' ? clr.indigoLt : 'transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            <input type="radio" name="type" checked={circlePrivacy === 'open'} onChange={() => setCirclePrivacy('open')} style={{ accentColor:clr.indigo }}/> Open
          </label>
          <label style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:14, borderRadius:16, border: circlePrivacy === 'private' ? `1.5px solid ${clr.indigo}` : `1.5px solid ${clr.border}`, background: circlePrivacy === 'private' ? clr.indigoLt : 'transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            <input type="radio" name="type" checked={circlePrivacy === 'private'} onChange={() => setCirclePrivacy('private')} style={{ accentColor:clr.indigo }}/> Private
          </label>
        </div>
        <textarea placeholder="Short description..." rows={3} style={{...inputStyle, resize:'none'}} />
        <button type="submit" style={submitStyle}>Create Circle →</button>
      </form>
    )
    if (show === 'event') return (
      <form onSubmit={e => { e.preventDefault(); onClose(); onShowToast('Event created successfully!') }}>
        <Handle /><Header title="Host an Event" />
        <input required placeholder="Event Name" style={inputStyle} />
        <div style={{ display:'flex', gap:10 }}>
          <input required type="date" style={{...inputStyle, flex:1}} />
          <input required type="time" style={{...inputStyle, flex:1}} />
        </div>
        <input required placeholder="Location" style={inputStyle} />
        <select style={inputStyle}>
          <option value="">No specific circle (Community Event)</option>
          {joinedCircles.map(id => { const c = circles.find(x => x.id === id); return c ? <option key={id} value={id}>{c.name}</option> : null })}
        </select>
        <input type="number" placeholder="Max attendees (optional)" style={inputStyle} />
        <button type="submit" style={submitStyle}>Create Event →</button>
      </form>
    )
    if (show === 'lfg') return (
      <form onSubmit={e => { e.preventDefault(); onClose(); onShowToast('LFG posted!') }}>
        <Handle /><Header title="Looking For Group" />
        <input required placeholder="What do you want to do? (Grab coffee, shoot hoops...)" style={inputStyle} />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {["Right now", "In 1hr", "This evening", "Custom"].map(t => <span key={t} style={{ padding:'8px 14px', borderRadius:999, border:`1.5px solid ${clr.border}`, fontSize:13, fontWeight:600, color:clr.textMid }}>{t}</span>)}
        </div>
        <input required placeholder="Where? (Neighborhood, park, etc)" style={inputStyle} />
        <button type="submit" style={{...submitStyle, background:`linear-gradient(135deg, #F59E0B, #FCD34D)`, color:'#FFF', boxShadow:'0 6px 20px rgba(245,158,11,0.3)'}}>Post LFG →</button>
      </form>
    )
    if (show === 'coffee') {
      const results = coffeeSearch.trim() ? people.filter(p => p.name.toLowerCase().includes(coffeeSearch.toLowerCase())).slice(0,3) : []
      return (
        <form onSubmit={e => { 
          e.preventDefault(); if (!coffeeTarget) return
          const chatId = startDM(coffeeTarget); sendMessage(chatId, `Hey ${coffeeTarget.name.split(' ')[0]}! Want to grab a coffee sometime? ☕`)
          onClose(); onShowToast('Invite sent!')
        }}>
          <Handle /><Header title="Coffee Chat Invite" />
          {!coffeeTarget ? (
            <div style={{ marginBottom:16 }}>
              <input placeholder="Who do you want to meet?" value={coffeeSearch} onChange={e => setCoffeeSearch(e.target.value)} style={inputStyle} autoFocus />
              {results.length > 0 && <div style={{ padding:'8px 0', border:`1px solid ${clr.border}`, borderRadius:16 }}>
                {results.map(p => (
                  <div key={p.id} onClick={() => setCoffeeTarget(p)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', cursor:'pointer' }}>
                    <img src={p.avatar} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover' }} />
                    <span style={{ fontSize:15, fontWeight:600, color:clr.textDark }}>{p.name}</span>
                  </div>
                ))}
              </div>}
            </div>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:14, borderRadius:16, border:`1.5px solid ${clr.border}`, marginBottom:16 }}>
                <img src={coffeeTarget.avatar} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover' }} />
                <span style={{ fontSize:15, fontWeight:600, color:clr.textDark, flex:1 }}>{coffeeTarget.name}</span>
                <button type="button" onClick={() => setCoffeeTarget(null)} style={{ background:'none', border:'none', fontSize:13, color:clr.textLight, cursor:'pointer' }}>Change</button>
              </div>
              <div style={{ display:'flex', gap:10 }}><input required type="date" style={{...inputStyle, flex:1}} /><input required type="time" style={{...inputStyle, flex:1}} /></div>
              <input required placeholder="Location suggestion (e.g. Ritual Cafe)" style={inputStyle} />
              <textarea placeholder="Add a short note... (optional)" rows={2} style={{...inputStyle, resize:'none'}} />
            </div>
          )}
          <button type="submit" disabled={!coffeeTarget} style={{...submitStyle, opacity: !coffeeTarget ? 0.5 : 1}}>Send Invite →</button>
        </form>
      )
    }
  }

  return <div style={bottomSheetStyle} onClick={onClose}><div style={sheetContentStyle} onClick={e => e.stopPropagation()}>{content()}</div></div>
}

/* ── Battery Helpers & Components ── */
function getBatteryConfig(points) {
  if (points >= 80) return {
    label:    'Fully Charged',
    sublabel: 'You\'re on fire socially 🔥',
    color:    '#10B981',  // green
    glow:     'rgba(16,185,129,0.4)',
    segments: 4,
  }
  if (points >= 60) return {
    label:    'Charged Up',
    sublabel: 'Keep the momentum going',
    color:    '#5B5FEF',  // indigo
    glow:     'rgba(91,95,239,0.4)',
    segments: 3,
  }
  if (points >= 35) return {
    label:    'Getting There',
    sublabel: 'A meetup would charge you up',
    color:    '#F59E0B',  // amber
    glow:     'rgba(245,158,11,0.4)',
    segments: 2,
  }
  return {
    label:    'Running Low',
    sublabel: 'Time to get out there 👋',
    color:    '#EF4444',  // red
    glow:     'rgba(239,68,68,0.4)',
    segments: 1,
  }
}

function BatteryIcon({ percentage, color, glow }) {
  const filledSegments = Math.ceil((percentage / 100) * 4)
  
  return (
    <div style={{ flexShrink: 0 }}>
      <svg 
        width="80" height="40" 
        viewBox="0 0 80 40" 
        fill="none"
      >
        <rect 
          x="2" y="4" 
          width="68" height="32" 
          rx="6" ry="6"
          stroke={color}
          strokeWidth="2.5"
          fill="none"
        />
        <rect 
          x="70" y="14" 
          width="8" height="12" 
          rx="2" ry="2"
          fill={color}
          opacity="0.6"
        />
        {[0,1,2,3].map(i => (
          <rect
            key={i}
            x={7 + i * 16}
            y={9}
            width={13}
            height={22}
            rx={3}
            fill={i < filledSegments ? color : clr.bg}
            style={{
              filter: i < filledSegments ? `drop-shadow(0 0 4px ${glow})` : 'none',
              transition: 'fill 0.5s ease',
            }}
          />
        ))}
        {percentage >= 60 && (
          <text 
            x="38" y="26" 
            textAnchor="middle"
            fontSize="14"
            style={{ userSelect: 'none' }}
          >
            ⚡
          </text>
        )}
      </svg>
      <p style={{
        fontSize: 11, fontWeight: 700,
        color: color, textAlign: 'center',
        margin: '4px 0 0 0',
        letterSpacing: '0.04em',
      }}>
        {percentage}%
      </p>
    </div>
  )
}

function SocialBattery() {
  const { batteryPoints, batteryHistory } = useAppContext()
  const [showHistory, setShowHistory] = useState(false)
  const config = getBatteryConfig(batteryPoints)

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        onClick={() => setShowHistory(h => !h)}
        style={{
          backgroundColor: clr.white,
          borderRadius: 24,
          padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: clr.textDark, margin: '0 0 2px 0' }}>
              Social Battery
            </p>
            <p style={{ fontSize: 12, color: clr.textMid, margin: 0 }}>
              {config.sublabel}
            </p>
          </div>
          <div style={{ backgroundColor: config.color + '20', borderRadius: 12, padding: '6px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: config.color, margin: 0, lineHeight: 1 }}>
              {batteryPoints}
            </p>
            <p style={{ fontSize: 9, fontWeight: 700, color: config.color, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              pts
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <BatteryIcon percentage={batteryPoints} color={config.color} glow={config.glow} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: config.color }}>{config.label}</span>
              <span style={{ fontSize: 12, color: clr.textMid }}>{batteryPoints}/100</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, backgroundColor: clr.bg, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${batteryPoints}%`,
                borderRadius: 999,
                backgroundColor: config.color,
                boxShadow: `0 0 8px ${config.glow}`,
                transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
              }}/>
            </div>
            <p style={{ fontSize: 11, color: clr.textMid, margin: '8px 0 0 0' }}>
              {batteryPoints < 35 
                ? '💡 Join a circle or attend an event to charge up'
                : batteryPoints < 60
                  ? '💡 Send a message or RSVP to boost your battery'
                  : '✨ Great work — keep socializing!'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      {showHistory && (
        <div style={{
          backgroundColor: clr.white,
          borderRadius: '0 0 24px 24px',
          marginTop: -8, paddingTop: 16,
          padding: '16px 20px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          animation: 'slideDown 0.2s ease',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent Activity
          </p>
          {batteryHistory.length === 0 ? (
            <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
              No activity yet — start socializing to charge up!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...batteryHistory].reverse().slice(0, 6).map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: clr.bg, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{h.points > 0 ? '⚡' : '😴'}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: clr.textDark, margin: 0 }}>{h.reason}</p>
                      <p style={{ fontSize: 11, color: clr.textMid, margin: 0 }}>{h.date} · {h.time}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: h.points > 0 ? '#10B981' : '#EF4444' }}>
                    {h.points > 0 ? '+' : ''}{h.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ── Main Feed ── */
export default function Feed() {
  const navigate = useNavigate()
  const { currentUser, joinedCircles, joinCircle, meetups, rsvpEvent, cancelRsvp, isRsvpd } = useAppContext()
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

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
  
  const firstName = currentUser.name?.split(' ')[0] ?? 'there'

  const upcomingMeetups = useMemo(() => {
    return [...(meetups || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3)
  }, [meetups])

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes expandUp { from { transform: scale(0.92) translateY(40px); opacity: 0; border-radius: 24px; } to { transform: scale(1) translateY(0); opacity: 1; border-radius: 0; } }
      @keyframes fadeToast { 0% { opacity: 0; transform: translateX(-50%) translateY(20px); } 15% { opacity: 1; transform: translateX(-50%) translateY(0); } 85% { opacity: 1; transform: translateX(-50%) translateY(0); } 100% { opacity: 0; transform: translateX(-50%) translateY(20px); } }
      @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    return {
      people: people.filter(p => p.name.toLowerCase().includes(q) || p.interests?.some(i => i.toLowerCase().includes(q)) || p.bio?.toLowerCase().includes(q)),
      circles: circles.filter(c => c.name.toLowerCase().includes(q) || c.interestTag?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)),
      events: events.filter(e => e.title.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q)),
    }
  }, [searchQuery])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div style={{ minHeight:'100vh', backgroundColor:clr.bg, fontFamily:"'DM Sans','Inter',sans-serif", paddingBottom:110 }}>

      <div style={{ padding:'0 16px', margin:'0 auto' }}>
        {/* ── Greeting ── */}
        <div style={{ padding:'12px 0 16px' }}>
          <h1 style={{ fontSize:26, fontWeight:800, color: clr.textDark, margin:'0 0 6px 0', letterSpacing:'-0.02em', fontFamily:"'DM Serif Display','Georgia',serif" }}>
            {getGreeting()}, {firstName} 👋
          </h1>
          <p style={{ fontSize:14, color: clr.textMid, margin:0, lineHeight:1.6 }}>Curating people, circles, and meetups that feel like you.</p>
        </div>

        {/* ── Search Bar ── */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <svg width="18" height="18" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24" style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Search people, circles, events..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px 14px 46px', borderRadius: 999, border: searchFocused ? `2px solid ${clr.indigo}` : '2px solid transparent', backgroundColor: clr.white, fontSize: 15, color: clr.textDark, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', boxShadow: searchFocused ? `0 0 0 4px rgba(91,95,239,0.1)` : '0 2px 10px rgba(0,0,0,0.03)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: clr.textLight, border: 'none', cursor: 'pointer', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="11" height="11" fill="none" stroke="#FFF" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* ── View Controller ── */}
        {searchResults ? (
          <div style={{ animation: 'slideUp 0.15s ease' }}>
            {searchResults.people.length === 0 && searchResults.circles.length === 0 && searchResults.events.length === 0 ? (
              <div style={{ padding:40, textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
                <p style={{ fontSize:16, fontWeight:700, color:clr.textDark, margin:'0 0 8px 0' }}>No results for "{searchQuery}"</p>
                <p style={{ fontSize:14, color:clr.textMid, margin:0 }}>Try adjusting your search terms.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
                {searchResults.people.length > 0 && (
                  <section><SectionHeader title="People" /><HScrollRow>{searchResults.people.map(p => <PersonCard key={p.id} person={p} />)}</HScrollRow></section>
                )}
                {searchResults.circles.length > 0 && (
                  <section><SectionHeader title="Circles" /><div style={{ display:'flex', flexDirection:'column', gap:10 }}>{searchResults.circles.map((c, idx) => <CircleCard key={c.id} circle={c} idx={idx} isJoined={joinedCircles.includes(c.id)} onJoin={() => joinCircle(c.id)} onClick={() => navigate(`/circles/${c.id}`)} />)}</div></section>
                )}
                {searchResults.events.length > 0 && (
                  <section><SectionHeader title="Events" /><HScrollRow>{searchResults.events.map((e, idx) => <EventCard key={e.id} event={e} idx={idx} isRsvpd={isRsvpd} onViewDetails={openEventDetail} />)}</HScrollRow></section>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: '0 0 14px 0' }}>Create</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {CREATE_ACTIONS.map(action => <CreateCard key={action.id} action={action} onClick={() => setShowCreateModal(action.id)} />)}
              </div>
            </section>
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: '0 0 14px 0' }}>Discover</h2>
              <button type="button" onClick={() => setShowDiscovery(true)} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                style={{ width: '100%', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 60%, #A78BFA 100%)', padding: '24px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 28px rgba(91,95,239,0.3)', transition: 'transform 0.2s ease' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>Meet Someone New</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Swipe through people, circles & events</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {people.slice(0, 3).map((p, i) => <img key={p.id} src={p.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid rgba(255,255,255,0.6)', marginLeft: i === 0 ? 0 : -14, zIndex: 3 - i, position: 'relative' }} />)}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}><svg width="16" height="16" fill="none" stroke="#FFFFFF" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
                </div>
              </button>
            </section>
            
            <div style={{ marginTop: 32 }}>
              <SocialBattery />
            </div>

            {upcomingMeetups.length > 0 && (
              <section style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: clr.textDark }}>
                      Up Next
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: clr.indigo, padding: '4px 0' }}
                  >
                    See all →
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {upcomingMeetups.map((meetup, idx) => (
                    <UpNextCard key={meetup.id} meetup={meetup} idx={idx} onViewDetails={openEventDetail} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <CreateModals show={showCreateModal} onClose={() => setShowCreateModal(null)} onShowToast={showToast} />
      {showDiscovery && <div style={{ position: 'fixed', inset: 0, zIndex: 200, animation: 'expandUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}><SwipeDiscovery onClose={() => setShowDiscovery(false)} /></div>}
      {toastMsg && <div style={{ position:'fixed', bottom:100, left:'50%', zIndex:400, transform:'translateX(-50%)', background:clr.textDark, color:'#FFF', padding:'12px 24px', borderRadius:999, fontSize:14, fontWeight:600, animation:'fadeToast 2.5s ease forwards', whiteSpace:'nowrap' }}>{toastMsg}</div>}

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
    </div>
  )
}

