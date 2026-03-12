import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { circles } from '../data/mockData'
import { useAppContext } from '../context/AppContext.jsx'
 
const clr = {
  bg:       '#F0F0F5',
  white:    '#FFFFFF',
  indigo:   '#5B5FEF',
  indigoLt: '#EEEEFF',
  teal:     '#0D9488',
  textDark: '#1A1A2E',
  textMid:  '#6B7280',
  textLight:'#9CA3AF',
  border:   '#E8E8EE',
}
 
const TABS = [
  { id: 'about',   label: 'About'   },
  { id: 'members', label: 'Members' },
  { id: 'events',  label: 'Events'  },
  { id: 'chat',    label: 'Chat'    },
]
 
const VIBE_ICONS = {
  'Beginner Friendly': '😊',
  'Weekly Meetups':    '📅',
  'Outdoors':          '🏔️',
  'All Levels':        '⭐',
  'Casual':            '☕',
  'Professional':      '💼',
}
 
export default function CircleDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const circle     = useMemo(() => circles.find((c) => c.id === id), [id])
  const { joinedCircles, joinCircle } = useAppContext()
  const [activeTab, setActiveTab] = useState('about')
 
  if (!circle) {
    return (
      <div style={{ padding:40, textAlign:'center', color: clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>
        Circle not found.
      </div>
    )
  }
 
  const isJoined  = joinedCircles.includes(circle.id)
  const isPrivate = circle.type === 'private'
 
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans','Inter',sans-serif",
      paddingBottom: 100,
    }}>
 
      {/* ── Hero banner ── */}
      <div style={{
        background: 'linear-gradient(160deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)',
        paddingBottom: 56,
        position: 'relative',
      }}>
        {/* Top bar */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 20px 0',
        }}>
          <button type="button" onClick={() => navigate(-1)} style={{
            background:'none', border:'none', cursor:'pointer', padding:4,
          }}>
            <svg width="22" height="22" fill="none" stroke="#FFFFFF" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <span style={{ fontSize:16, fontWeight:700, color:'#FFFFFF' }}>
            {circle.name} {circle.emoji}
          </span>
          <button type="button" style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="5"  r="1" fill="#FFFFFF"/>
              <circle cx="12" cy="12" r="1" fill="#FFFFFF"/>
              <circle cx="12" cy="19" r="1" fill="#FFFFFF"/>
            </svg>
          </button>
        </div>
 
        {/* Circle icon */}
        <div style={{ display:'flex', justifyContent:'center', marginTop:24, marginBottom:20 }}>
          <div style={{
            width:90, height:90, borderRadius:'50%',
            backgroundColor:'rgba(255,255,255,0.18)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <div style={{
              width:68, height:68, borderRadius:'50%',
              backgroundColor:'rgba(255,255,255,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:32,
            }}>
              {circle.emoji ?? '⭕'}
            </div>
          </div>
        </div>
 
        {/* Circle name + status */}
        <div style={{ textAlign:'center', padding:'0 20px' }}>
          <h1 style={{
            fontSize:28, fontWeight:800, color:'#FFFFFF',
            margin:'0 0 12px 0', letterSpacing:'-0.02em',
            fontFamily:"'DM Serif Display','Georgia',serif",
          }}>
            {circle.name}
          </h1>
          <div style={{
            display:'inline-flex', alignItems:'center',
            backgroundColor: clr.teal,
            borderRadius:999, padding:'5px 16px',
            fontSize:11, fontWeight:700, color:'#FFFFFF',
            letterSpacing:'0.1em', textTransform:'uppercase',
          }}>
            Active
          </div>
        </div>
 
        {/* Join button — floats over the bottom of the hero */}
        <div style={{
          position:'absolute', bottom:-22,
          left:0, right:0,
          display:'flex', justifyContent:'center',
        }}>
          <button
            type="button"
            onClick={() => { if (!isJoined) joinCircle(circle.id) }}
            style={{
              padding:'12px 40px',
              borderRadius:999,
              border:'none',
              backgroundColor: clr.white,
              color: isJoined ? clr.textMid : clr.indigo,
              fontSize:16, fontWeight:700,
              cursor: isJoined ? 'default' : 'pointer',
              boxShadow:'0 6px 24px rgba(0,0,0,0.15)',
            }}
          >
            {isJoined ? '✓ Joined' : isPrivate ? 'Request to Join' : 'Join Circle'}
          </button>
        </div>
      </div>
 
      {/* ── Tabs ── */}
      <div style={{
        backgroundColor: clr.white,
        borderBottom: `1px solid ${clr.border}`,
        marginTop:0, paddingTop:32,
        display:'flex', justifyContent:'center',
      }}>
        <div style={{ display:'flex', gap:0 }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding:'12px 22px',
                  background:'none', border:'none', cursor:'pointer',
                  fontSize:15, fontWeight: active ? 700 : 500,
                  color: active ? clr.indigo : clr.textMid,
                  borderBottom: active ? `2.5px solid ${clr.indigo}` : '2.5px solid transparent',
                  transition:'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
 
      {/* ── Tab content ── */}
      <div style={{ padding:'20px 16px', maxWidth:500, margin:'0 auto' }}>
 
        {/* ABOUT */}
        {activeTab === 'about' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
 
            {/* Description */}
            <div style={{
              backgroundColor: clr.white, borderRadius:20,
              padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontSize:18, fontWeight:800, color: clr.textDark, margin:'0 0 12px 0' }}>Description</h3>
              <p style={{ fontSize:15, color: clr.textMid, lineHeight:1.7, margin:0 }}>{circle.description}</p>
            </div>
 
            {/* Circle Vibe */}
            <div style={{
              backgroundColor: clr.white, borderRadius:20,
              padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontSize:18, fontWeight:800, color: clr.textDark, margin:'0 0 14px 0' }}>Circle Vibe</h3>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {(circle.vibes ?? circle.vibe?.split(',').map(v=>v.trim()) ?? []).map((v) => (
                  <span key={v} style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    padding:'9px 16px', borderRadius:999,
                    border:`1.5px solid ${clr.border}`,
                    backgroundColor: clr.white,
                    fontSize:14, color: clr.textDark, fontWeight:500,
                  }}>
                    <span>{VIBE_ICONS[v] ?? '✨'}</span> {v}
                  </span>
                ))}
              </div>
            </div>
 
            {/* Organizer */}
            <div style={{
              backgroundColor: clr.white, borderRadius:20,
              padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontSize:18, fontWeight:800, color: clr.textDark, margin:'0 0 14px 0' }}>Organizer</h3>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ position:'relative' }}>
                    <img
                      src={circle.organizer?.avatar}
                      alt={circle.organizer?.name}
                      style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover' }}
                    />
                    <div style={{
                      position:'absolute', bottom:0, right:0,
                      width:18, height:18, borderRadius:'50%',
                      backgroundColor: clr.indigo,
                      border:`2px solid ${clr.white}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <svg width="9" height="9" fill="none" stroke="#FFFFFF" strokeWidth="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize:16, fontWeight:700, color: clr.textDark, margin:0 }}>
                      {circle.organizer?.name}
                    </p>
                    <p style={{ fontSize:13, color: clr.indigo, margin:0, fontWeight:500 }}>
                      {circle.organizer?.role ?? 'Organizer'}
                    </p>
                  </div>
                </div>
                <button type="button" style={{
                  padding:'10px 22px', borderRadius:999,
                  border:`1.5px solid ${clr.border}`,
                  backgroundColor: clr.white,
                  fontSize:14, fontWeight:600, color: clr.textDark,
                  cursor:'pointer',
                }}>
                  Message
                </button>
              </div>
            </div>
 
            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { value: circle.memberCount ?? circle.members?.length ?? 0, label:'MEMBERS'  },
                { value: circle.events?.length ?? 0,                        label:'UPCOMING' },
              ].map(({ value, label }) => (
                <div key={label} style={{
                  backgroundColor: clr.white, borderRadius:20,
                  padding:'18px 12px', textAlign:'center',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                }}>
                  <p style={{ fontSize:28, fontWeight:800, color: clr.indigo, margin:'0 0 4px 0' }}>{value}</p>
                  <p style={{ fontSize:11, color: clr.textMid, margin:0, letterSpacing:'0.08em', fontWeight:600 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
 
        {/* MEMBERS */}
        {activeTab === 'members' && (
          <div style={{
            backgroundColor: clr.white, borderRadius:20,
            padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {circle.members?.map((member) => (
                <div key={member.id} style={{
                  display:'flex', alignItems:'center', gap:10,
                  backgroundColor:'#F7F7FB', borderRadius:14,
                  padding:'10px 12px',
                }}>
                  <img src={member.avatar} alt={member.name} style={{
                    width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0,
                  }}/>
                  <span style={{ fontSize:13, fontWeight:600, color: clr.textDark,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {member.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
 
        {/* EVENTS */}
        {activeTab === 'events' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {(!circle.events || circle.events.length === 0) ? (
              <p style={{ fontSize:14, color: clr.textMid, padding:20 }}>No upcoming events yet.</p>
            ) : circle.events.map((event) => (
              <div key={event.id} style={{
                backgroundColor: clr.white, borderRadius:20,
                padding:'18px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
              }}>
                {/* Date block */}
                <div style={{
                  width:52, flexShrink:0, textAlign:'center',
                  backgroundColor: clr.indigoLt, borderRadius:14, padding:'10px 6px',
                }}>
                  <p style={{ fontSize:22, fontWeight:800, color: clr.indigo, margin:0, lineHeight:1 }}>
                    {event.date?.split(' ')[1] ?? event.date?.split('-')[2] ?? '—'}
                  </p>
                  <p style={{ fontSize:10, fontWeight:700, color: clr.indigo, margin:'2px 0 0', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    {event.date?.split(' ')[0] ?? 'Mar'}
                  </p>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:15, fontWeight:700, color: clr.textDark, margin:'0 0 4px 0' }}>{event.title}</p>
                  <p style={{ fontSize:12, color: clr.textMid, margin:0 }}>{event.time} · {event.location}</p>
                </div>
                <button type="button" style={{
                  padding:'9px 18px', borderRadius:999, border:'none',
                  background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
                  color:'#FFFFFF', fontSize:13, fontWeight:600, cursor:'pointer',
                  flexShrink:0,
                }}>
                  RSVP
                </button>
              </div>
            ))}
          </div>
        )}
 
        {/* CHAT */}
        {activeTab === 'chat' && (
          <div style={{
            backgroundColor: clr.white, borderRadius:20,
            padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
            display:'flex', flexDirection:'column', gap:16,
          }}>
            <h3 style={{ fontSize:16, fontWeight:700, color: clr.textDark, margin:0 }}>Latest Messages</h3>
            <div style={{
              backgroundColor:'#F7F7FB', borderRadius:16, padding:'14px',
              display:'flex', flexDirection:'column', gap:14,
            }}>
              {circle.chatPreview?.map((msg) => (
                <div key={msg.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:700, color: clr.textDark }}>{msg.sender}</span>
                    <span style={{ fontSize:11, color: clr.textLight }}>{msg.timestamp}</span>
                  </div>
                  <p style={{ fontSize:14, color: clr.textMid, margin:0, lineHeight:1.5 }}>{msg.text}</p>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'center' }}>
              <Link to={`/chat/${circle.chatId}`} style={{
                padding:'13px 40px', borderRadius:999, textDecoration:'none',
                background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
                color:'#FFFFFF', fontSize:15, fontWeight:700,
                boxShadow:'0 6px 20px rgba(91,95,239,0.35)',
              }}>
                Open Chat →
              </Link>
            </div>
          </div>
        )}
 
      </div>
    </div>
  )
}

