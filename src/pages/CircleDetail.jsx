import { useMemo, useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { circles, people } from '../data/mockData'
import { useAppContext } from '../context/AppContext.jsx'
import EventDetailModal from '../components/EventDetailModal.jsx'
import HoopApplication from '../components/hoops/HoopApplication.jsx'
import OrganizerReview from '../components/hoops/OrganizerReview.jsx'
 
const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  teal:     '#0D9488',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
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
  const { currentUser, pendingApplications, joinedCircles, joinCircle, leaveCircle, startGroupChat, rsvpEvent, cancelRsvp, isRsvpd, chatState, sendMessage, startDM } = useAppContext()
  const [activeTab, setActiveTab] = useState('about')
  const [showHoopApp, setShowHoopApp] = useState(false)
  const [activeChannel, setActiveChannel] = useState('general')
  const [chatInput, setChatInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [toastMsg, setToastMsg] = useState(null)
  const msgsEndRef = useRef(null)

  useEffect(() => {
    if (activeTab === 'chat') {
      msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeTab, activeChannel, chatState, circle?.chatId])

  // Event detail modal state
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [detailClosing, setDetailClosing] = useState(false)

  const openEventDetail = (event) => setSelectedEvent({ ...event, circleId: circle?.id, circleName: circle?.name })
  const closeEventDetail = () => {
    setDetailClosing(true)
    setTimeout(() => {
      setSelectedEvent(null)
      setDetailClosing(false)
    }, 300)
  }
 
  if (!circle) {
    return (
      <div style={{ padding:40, textAlign:'center', color: clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>
        Circle not found.
      </div>
    )
  }
 
  const isJoined  = joinedCircles.includes(circle.id)
  const isPrivate = circle.type === 'private'
  const isOrganizer = circle.organizer?.name === currentUser.name
  const hasHoops = !!circle.hoops?.length
  const pendingApp = pendingApplications?.find(a => a.circleId === circle.id && a.applicantId === currentUser.id && a.status === 'pending')

  const dynamicTabs = useMemo(() => {
    const base = [...TABS]
    if (isOrganizer) base.push({ id: 'applications', label: 'Applications' })
    return base
  }, [isOrganizer])

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
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowDropdown(!showDropdown)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
              <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="5"  r="1" fill="#FFFFFF"/>
                <circle cx="12" cy="12" r="1" fill="#FFFFFF"/>
                <circle cx="12" cy="19" r="1" fill="#FFFFFF"/>
              </svg>
            </button>
            {showDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                backgroundColor: clr.white,
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                padding: 4,
                width: 140,
                zIndex: 50,
              }}>
                <button
                  type="button"
                  onClick={() => {
                    leaveCircle(circle.id)
                    setShowDropdown(false)
                    navigate('/circles')
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    textAlign: 'left',
                    color: '#EF4444',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Leave Circle
                </button>
              </div>
            )}
          </div>
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
          {isJoined ? (
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              style={{
                padding:'12px 40px',
                borderRadius:999,
                border:'none',
                background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                color: '#FFF',
                fontSize:16, fontWeight:800,
                cursor: 'pointer',
                boxShadow:'0 6px 24px rgba(91,95,239,0.3)',
              }}
            >
              Open Chat
            </button>
          ) : pendingApp ? (
            <button
              type="button"
              disabled
              style={{
                padding:'12px 40px', borderRadius:999, border:'none',
                backgroundColor: clr.white, color: clr.textMid,
                fontSize:16, fontWeight:700, cursor: 'not-allowed',
                boxShadow:'0 6px 24px rgba(0,0,0,0.15)',
              }}
            >
              ⏳ Pending Review
            </button>
          ) : hasHoops ? (
            <button
              type="button"
              onClick={() => setShowHoopApp(true)}
              style={{
                padding:'12px 40px', borderRadius:999, border:'none',
                backgroundColor: clr.white, color: clr.indigo,
                fontSize:16, fontWeight:700, cursor: 'pointer',
                boxShadow:'0 6px 24px rgba(0,0,0,0.15)',
              }}
            >
              Apply to Join 🏀
            </button>
          ) : (
            <button
              type="button"
              onClick={() => joinCircle(circle.id)}
              style={{
                padding:'12px 40px',
                borderRadius:999,
                border:'none',
                backgroundColor: clr.white,
                color: clr.indigo,
                fontSize:16, fontWeight:700,
                cursor: 'pointer',
                boxShadow:'0 6px 24px rgba(0,0,0,0.15)',
              }}
            >
              {isPrivate ? 'Request to Join' : 'Join Circle'}
            </button>
          )}
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
          {dynamicTabs.map((tab) => {
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
      <div style={{ padding:'20px 16px', margin:'0 auto' }}>
 
        {/* ABOUT */}
        {activeTab === 'about' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            
            {/* Entry Requirements */}
            {hasHoops && (
              <div style={{
                backgroundColor: clr.white, borderRadius:20,
                padding:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
              }}>
                <h3 style={{ fontSize:18, fontWeight:800, color: clr.textDark, margin:'0 0 12px 0' }}>Entry Requirements</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {circle.hoops.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'center', backgroundColor: clr.bg, padding: '12px 16px', borderRadius: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: clr.indigoLt, color: clr.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: clr.textDark }}>
                          {h.type === 'written' ? '✍️ Written' : h.type === 'video' ? '🎥 Video' : h.type === 'voice' ? '🎤 Voice' : '📋 Multiple Choice'}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', backgroundColor: '#FEF3C7', padding: '4px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Required</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Invite Button */}
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                width: '100%', padding: '16px', borderRadius: 20,
                border: `1.5px dashed ${clr.indigo}`, backgroundColor: clr.indigoLt,
                color: clr.indigo, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Invite Connections
            </button>

            {/* Members List */}
            <div style={{
              backgroundColor: clr.white, borderRadius: 20,
              padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {circle.members?.map((member) => (
                  <div key={member.id} onClick={() => navigate(`/user/${member.id}`)} style={{
                    display:'flex', alignItems:'center', gap:10,
                    backgroundColor: clr.bg, borderRadius:14,
                    padding:'10px 12px', cursor: 'pointer'
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
          </div>
        )}
 
        {/* EVENTS */}
        {activeTab === 'events' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {(!circle.events || circle.events.length === 0) ? (
              <p style={{ fontSize:14, color: clr.textMid, padding:20 }}>No upcoming events yet.</p>
            ) : circle.events.map((event) => {
              const going = isRsvpd(event.id)
              return (
                <div key={event.id} onClick={() => openEventDetail(event)} style={{
                  backgroundColor: clr.white, borderRadius:20,
                  padding:'18px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
                  cursor: 'pointer',
                }}>
                  {/* Date block */}
                  <div style={{
                    width:52, flexShrink:0, textAlign:'center',
                    backgroundColor: going ? '#DCFCE7' : clr.indigoLt, borderRadius:14, padding:'10px 6px',
                  }}>
                    <p style={{ fontSize:22, fontWeight:800, color: going ? '#059669' : clr.indigo, margin:0, lineHeight:1 }}>
                      {event.date?.split(' ')[1] ?? event.date?.split('-')[2] ?? '—'}
                    </p>
                    <p style={{ fontSize:10, fontWeight:700, color: going ? '#059669' : clr.indigo, margin:'2px 0 0', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                      {event.date?.split(' ')[0] ?? 'Mar'}
                    </p>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:15, fontWeight:700, color: clr.textDark, margin:'0 0 4px 0' }}>{event.title}</p>
                    <p style={{ fontSize:12, color: clr.textMid, margin:0 }}>{event.time} · {event.location}</p>
                  </div>
                  {going ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); cancelRsvp(event.id); }} style={{
                      padding:'9px 18px', borderRadius:999, border:'none',
                      background:'#FEE2E2',
                      color:'#DC2626', fontSize:13, fontWeight:600, cursor:'pointer',
                      flexShrink:0,
                    }}>
                      Cancel
                    </button>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEventDetail(event); }} style={{
                      padding:'9px 18px', borderRadius:999, border:'none',
                      background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
                      color:'#FFFFFF', fontSize:13, fontWeight:600, cursor:'pointer',
                      flexShrink:0,
                    }}>
                      Details
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
 
        {/* CHAT */}
        {activeTab === 'chat' && (() => {
          const chatId = circle.chatId || `circle-${circle.id}`;
          const chatData = chatState[chatId] || { messages: [], channels: ['general', 'planning', 'photos', 'meetups'] };
          const channels = chatData.channels || ['general', 'planning', 'photos', 'meetups'];
          const messages = (chatData.messages || []).filter(m => m.channelId === activeChannel || (!m.channelId && activeChannel === 'general'));

          return (
            <div style={{
              backgroundColor: clr.white, borderRadius:20,
              boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
              display:'flex', flexDirection:'column', height: 500,
              overflow: 'hidden'
            }}>
              {/* Channel selector horizontal bar */}
              <div style={{
                display: 'flex', gap: 8, padding: '16px 20px',
                borderBottom: `1px solid ${clr.border}`,
                overflowX: 'auto', scrollbarWidth: 'none',
                backgroundColor: clr.bg
              }}>
                {channels.map(ch => {
                  const isActive = activeChannel === ch;
                  return (
                    <button key={ch} type="button" onClick={() => setActiveChannel(ch)} style={{
                      padding: '8px 16px', borderRadius: 999, border: 'none',
                      backgroundColor: isActive ? clr.indigo : clr.white,
                      color: isActive ? '#fff' : clr.textDark,
                      fontSize: 14, fontWeight: isActive ? 700 : 600,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      boxShadow: isActive ? '0 4px 12px rgba(91,95,239,0.25)' : '0 2px 6px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s ease',
                    }}>
                      #{ch}
                    </button>
                  )
                })}
                {showNewChannel ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const val = newChannelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                    if (val && !channels.includes(val)) {
                      setChatState(prev => ({
                        ...prev,
                        [chatId]: {
                          ...prev[chatId],
                          channels: [...channels, val]
                        }
                      }));
                      setActiveChannel(val);
                    }
                    setShowNewChannel(false);
                    setNewChannelName('');
                  }} style={{ display: 'flex' }}>
                    <input
                      autoFocus
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      onBlur={() => {
                        // Allow small delay for submit if clicked instead of enter
                        setTimeout(() => setShowNewChannel(false), 150)
                      }}
                      placeholder="new-channel"
                      style={{
                        padding: '8px 16px', borderRadius: 999, border: `1.5px solid ${clr.indigo}`,
                        backgroundColor: clr.white, color: clr.textDark,
                        fontSize: 14, fontWeight: 600, outline: 'none', width: 120
                      }}
                    />
                  </form>
                ) : (
                  <button type="button" onClick={() => setShowNewChannel(true)} style={{
                    padding: '8px 16px', borderRadius: 999, border: `1px dashed ${clr.border}`,
                    backgroundColor: 'transparent', color: clr.textMid,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <span>+</span> Add
                  </button>
                )}
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 ? (
                  <div style={{ margin: 'auto', color: clr.textMid, fontSize: 14 }}>No messages in #{activeChannel} yet.</div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender === 'You' || msg.isMe;
                    return (
                      <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {!isMe && (
                          <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.senderName || msg.sender}</span>
                        )}
                        <div style={{
                          maxWidth: '75%',
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: isMe ? clr.indigo : clr.bg,
                          color: isMe ? '#FFFFFF' : clr.textDark,
                          fontSize: 14, lineHeight: 1.4,
                          boxShadow: isMe ? '0 4px 14px rgba(91,95,239,0.3)' : '0 2px 6px rgba(0,0,0,0.04)',
                        }}>
                          {msg.text}
                        </div>
                        <span style={{ fontSize:10, color: clr.textLight, marginTop:4, marginLeft:4, marginRight:4 }}>
                          {msg.time ?? msg.timestamp ?? ''}
                        </span>
                      </div>
                    )
                  })
                )}
                <div ref={msgsEndRef} />
              </div>

              {/* Input area */}
              <form onSubmit={(e) => {
                e.preventDefault()
                if (!chatInput.trim()) return
                startGroupChat(circle)
                sendMessage(chatId, chatInput, activeChannel)
                setChatInput('')
              }} style={{
                display: 'flex', gap: 10, padding: '14px 20px',
                borderTop: `1px solid ${clr.border}`,
                backgroundColor: clr.white,
              }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={`Message #${activeChannel}...`}
                  style={{
                    flex:1, padding:'12px 16px', borderRadius:999,
                    border:`1.5px solid ${clr.border}`,
                    backgroundColor: clr.bg,
                    fontSize:14, color: clr.textDark,
                    outline:'none', fontFamily:'inherit',
                  }}
                />
                <button type="submit" style={{
                  width:42, height:42, borderRadius:'50%', border:'none',
                  background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', flexShrink:0,
                  boxShadow:'0 4px 12px rgba(91,95,239,0.35)',
                }}>
                  <svg width="18" height="18" fill="none" stroke="#FFFFFF" strokeWidth="2.2" viewBox="0 0 24 24">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            </div>
          )
        })()}
 
        {/* APPLICATIONS */}
        {activeTab === 'applications' && isOrganizer && (
          <OrganizerReview circle={circle} />
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={closeEventDetail}
          closing={detailClosing}
          isRsvpd={isRsvpd}
          onRsvp={(evt) => rsvpEvent(evt, circle)}
          onCancelRsvp={(evtId) => cancelRsvp(evtId)}
        />
      )}

      {/* Invite Modal Overlay */}
      {showInviteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          backgroundColor: 'rgba(15,15,30,0.5)', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', alignItems: 'center'
        }} onClick={() => { setShowInviteModal(false); setInviteSearch(''); }}>
          <div style={{
            backgroundColor: clr.white, width: '100%', maxWidth: 500,
            borderRadius: '24px 24px 0 0', padding: '24px 20px 48px',
            animation: 'slideUp 0.25s ease', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 32, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: clr.textDark }}>Invite Connections</h3>
              <button onClick={() => { setShowInviteModal(false); setInviteSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            
            <input 
              autoFocus
              placeholder="Search connections..." 
              value={inviteSearch}
              onChange={e => setInviteSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16,
                border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 15,
                color: clr.textDark, outline: 'none', fontFamily: 'inherit', marginBottom: 16
              }}
            />

            <div style={{ overflowY: 'auto', flex: 1, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
              {people
                .filter(p => p.name.toLowerCase().includes(inviteSearch.toLowerCase()))
                .slice(0, 10)
                .map(p => {
                  const alreadyMember = circle.members?.some(m => m.id === p.id)
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${clr.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={p.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: clr.textDark }}>{p.name}</span>
                      </div>
                      <button 
                        disabled={alreadyMember}
                        onClick={() => {
                          const chatId = startDM(p);
                          sendMessage(chatId, `Hey ${p.name.split(' ')[0]}! I think you'd love this circle: ${circle.name}. You should check it out! 🌟`);
                          setShowInviteModal(false);
                          setInviteSearch('');
                          setToastMsg(`Invite sent to ${p.name}!`);
                          setTimeout(() => setToastMsg(null), 2500);
                        }}
                        style={{
                          padding: '8px 16px', borderRadius: 999, border: 'none',
                          backgroundColor: alreadyMember ? clr.bg : clr.indigo,
                          color: alreadyMember ? clr.textMid : '#FFF',
                          fontSize: 13, fontWeight: 700, cursor: alreadyMember ? 'default' : 'pointer',
                        }}
                      >
                        {alreadyMember ? 'Joined' : 'Invite'}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', zIndex: 400, transform: 'translateX(-50%)',
          background: clr.textDark, color: '#FFF', padding: '12px 24px', borderRadius: 999,
          fontSize: 14, fontWeight: 600, animation: 'fadeToast 2.5s ease forwards', whiteSpace: 'nowrap'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Hoop Application Modal */}
      {showHoopApp && <HoopApplication circle={circle} onClose={() => setShowHoopApp(false)} />}

      {/* Styles */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeToast {
          0% { opacity: 0; transform: translate(-50%, 20px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          85% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -20px); }
        }
      `}</style>
    </div>
  )
}

