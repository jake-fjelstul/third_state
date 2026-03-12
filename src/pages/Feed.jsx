import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { people, circles, events } from '../data/mockData'
 
const clr = {
  bg:       '#F0F0F5',
  white:    '#FFFFFF',
  indigo:   '#5B5FEF',
  indigoLt: '#EEEEFF',
  amber:    '#F59E0B',
  green:    '#22C55E',
  textDark: '#1A1A2E',
  textMid:  '#6B7280',
  textLight:'#9CA3AF',
  border:   '#E8E8EE',
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
  return (
    <div style={{
      flexShrink:0, width:170,
      backgroundColor: clr.white,
      borderRadius:20, padding:'16px 14px',
      boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
      display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
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
      <button type="button" style={{
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
function EventCard({ event, idx }) {
  const [rsvpd, setRsvpd] = useState(false)
  return (
    <div style={{
      flexShrink:0, width:220,
      backgroundColor: clr.white,
      borderRadius:20, overflow:'hidden',
      boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
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
                <img key={i} src={a.avatar ?? `https://i.pravatar.cc/150?u=${i}`} alt=""
                  style={{ width:22, height:22, borderRadius:'50%', objectFit:'cover',
                    border:`2px solid ${clr.white}`, marginLeft: i===0?0:-8 }}/>
              ))}
            </div>
            <span style={{ fontSize:11, color: clr.textLight }}>
              {event.attendees.length}+ going
            </span>
          </div>
        )}
        <button type="button" onClick={() => setRsvpd(r => !r)} style={{
          width:'100%', padding:'9px 0', borderRadius:999, border:'none',
          background: rsvpd ? clr.indigoLt : `linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
          color: rsvpd ? clr.indigo : '#FFFFFF',
          fontSize:13, fontWeight:700, cursor:'pointer',
          boxShadow: rsvpd ? 'none' : '0 4px 12px rgba(91,95,239,0.3)',
          transition:'all 0.2s ease',
        }}>
          {rsvpd ? '✓ Going' : 'RSVP'}
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
 
/* ── Section header ── */
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom:14 }}>
      <h2 style={{ fontSize:20, fontWeight:800, color: clr.textDark, margin:'0 0 4px 0' }}>{title}</h2>
      {subtitle && <p style={{ fontSize:13, color: clr.textMid, margin:0 }}>{subtitle}</p>}
    </div>
  )
}
 
/* ── Main Feed ── */
export default function Feed() {
  const navigate = useNavigate()
  const { currentUser, joinedCircles, joinCircle } = useAppContext()
  const [activeTab, setActiveTab] = useState('for-you')
 
  const firstName = currentUser.name?.split(' ')[0] ?? 'there'
 
  const recommendedPeople = useMemo(() => {
    const interests = new Set(currentUser.interests ?? [])
    return people.filter(p => p.interests?.some(i => interests.has(i)))
  }, [currentUser.interests])
 
  const recommendedCircles = useMemo(() =>
    circles.filter(c => currentUser.interests?.includes(c.interestTag)),
    [currentUser.interests]
  )
 
  const sortedEvents = useMemo(() =>
    [...events].sort((a,b) => new Date(a.date) - new Date(b.date)),
    []
  )
 
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }
 
  return (
    <div style={{
      minHeight:'100vh',
      backgroundColor: clr.bg,
      fontFamily:"'DM Sans','Inter',sans-serif",
      paddingBottom:100,
    }}>
 
      {/* ── Top bar ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'20px 20px 8px',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
            <circle cx="22" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
            <circle cx="34" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
          </svg>
          <span style={{ fontSize:17, fontWeight:800, color: clr.textDark }}>Third Space</span>
        </div>
        {/* Bell */}
        <div style={{ position:'relative' }}>
          <button type="button" style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          <div style={{
            position:'absolute', top:2, right:2,
            width:8, height:8, borderRadius:'50%',
            backgroundColor: clr.amber,
          }}/>
        </div>
      </div>
 
      <div style={{ padding:'0 16px', maxWidth:560, margin:'0 auto' }}>
 
        {/* ── Greeting ── */}
        <div style={{ padding:'12px 0 20px' }}>
          <h1 style={{
            fontSize:26, fontWeight:800, color: clr.textDark,
            margin:'0 0 6px 0', letterSpacing:'-0.02em',
            fontFamily:"'DM Serif Display','Georgia',serif",
          }}>
            {getGreeting()}, {firstName} 👋
          </h1>
          <p style={{ fontSize:14, color: clr.textMid, margin:0, lineHeight:1.6 }}>
            Curating people, circles, and meetups that feel like you.
          </p>
        </div>
 
        {/* ── Tab switcher ── */}
        <div style={{
          display:'inline-flex', gap:4,
          backgroundColor:'#E4E4ED',
          borderRadius:999, padding:4,
          marginBottom:24,
        }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding:'8px 18px', borderRadius:999,
                  border:'none', cursor:'pointer',
                  backgroundColor: active ? clr.white : 'transparent',
                  color: active ? clr.textDark : clr.textMid,
                  fontSize:14, fontWeight: active ? 700 : 500,
                  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition:'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
 
        {/* ══ FOR YOU tab ══ */}
        {activeTab === 'for-you' && (
          <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
 
            {/* People */}
            <section>
              <SectionHeader
                title="People You Might Click With"
                subtitle={`Based on your interests · ${currentUser.interests?.slice(0,2).join(', ')}`}
              />
              <HScrollRow>
                {recommendedPeople.map(person => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </HScrollRow>
            </section>
 
            {/* Circles */}
            <section>
              <SectionHeader
                title="Circles You'd Love"
                subtitle="Small groups built around the things you care about"
              />
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {recommendedCircles.map((circle, idx) => (
                  <CircleCard
                    key={circle.id}
                    circle={circle}
                    idx={idx}
                    isJoined={joinedCircles.includes(circle.id)}
                    onJoin={() => joinCircle(circle.id)}
                    onClick={() => navigate(`/circles/${circle.id}`)}
                  />
                ))}
              </div>
            </section>
 
            {/* Events */}
            <section>
              <SectionHeader
                title="Nearby Events"
                subtitle="Lightly structured meetups hosted by your circles"
              />
              <HScrollRow>
                {sortedEvents.map((event, idx) => (
                  <EventCard key={event.id} event={event} idx={idx} />
                ))}
              </HScrollRow>
            </section>
 
          </div>
        )}
 
        {/* ══ CIRCLES tab ══ */}
        {activeTab === 'circles' && (
          <div>
            <SectionHeader
              title="All Circles"
              subtitle="Browse communities around interests and neighborhoods"
            />
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {circles.map((circle, idx) => (
                <CircleCard
                  key={circle.id}
                  circle={circle}
                  idx={idx}
                  isJoined={joinedCircles.includes(circle.id)}
                  onJoin={() => joinCircle(circle.id)}
                  onClick={() => navigate(`/circles/${circle.id}`)}
                />
              ))}
            </div>
          </div>
        )}
 
        {/* ══ EVENTS tab ══ */}
        {activeTab === 'events' && (
          <div>
            <SectionHeader
              title="Upcoming Events"
              subtitle="What's happening across your city"
            />
            <div style={{ display:'flex', flexWrap:'wrap', gap:14 }}>
              {sortedEvents.map((event, idx) => (
                <EventCard key={event.id} event={event} idx={idx} />
              ))}
            </div>
          </div>
        )}
 
      </div>
    </div>
  )
}

