import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProfileById } from '../lib/profiles'
import { listCirclesForUser } from '../lib/circles'
import { listUpcomingEventsForUser } from '../lib/events'
import { useAppContext } from '../context/AppContext.jsx'
import { avatarFor } from '../lib/avatar'
import { resolveCircleCover } from '../lib/circleCover'
import CircleIcon from '../components/ui/CircleIcon.jsx'
import { getAvailabilityForUser, checkConflictAt, computeFreeSlots } from '../lib/availability'
import { getConnectionStats } from '../lib/connectionStats'
import TimePicker from '../components/TimePicker.jsx'
import ReportModal from '../components/moderation/ReportModal.jsx'
import { Flame, Calendar, AlertTriangle, CheckCircle, Users, Flag, Unlock, Ban } from 'lucide-react'

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

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], {
  hour: 'numeric', minute: '2-digit',
})

function formatConnectionDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return null
  }
}

export default function UserProfile() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { connections, connectWithPerson, disconnectFromPerson, startDM, sendMessage, currentUser, blockedUserIds, blockUserById, unblockUserById } = useAppContext()
  const [person, setPerson] = useState(null)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [personLoading, setPersonLoading] = useState(true)
  const [personCircles, setPersonCircles] = useState([])
  const [connecting, setConnecting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const [availability, setAvailability] = useState([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  const [showMeetupModal, setShowMeetupModal] = useState(false)
  const [suggestPrefill, setSuggestPrefill] = useState(null)
  const [meetupDate, setMeetupDate] = useState('')
  const [meetupTime, setMeetupTime] = useState('12:00')
  const [meetupLocation, setMeetupLocation] = useState('')
  const [meetupNote, setMeetupNote] = useState('')
  const [conflict, setConflict] = useState(null)
  const [conflictChecking, setConflictChecking] = useState(false)

  const openSuggestModal = (prefill = null) => {
    setSuggestPrefill(prefill)
    setShowMeetupModal(true)
  }

  useEffect(() => {
    if (!id) return
    const activeBlockedIds = blockedUserIds || []
    if (activeBlockedIds.includes(id)) {
      setPerson(null)
      setPersonCircles([])
      setPersonLoading(false)
      return
    }
    let cancelled = false
    setPersonLoading(true)
    Promise.all([getProfileById(id), listCirclesForUser(id)])
      .then(([prof, crc]) => {
        if (cancelled) return
        if (activeBlockedIds.includes(prof?.id)) {
          setPerson(null)
          setPersonCircles([])
        } else {
          setPerson(prof)
          setPersonCircles(crc)
        }
      })
      .catch(err => console.error('[UserProfile] load failed', err))
      .finally(() => { if (!cancelled) setPersonLoading(false) })
    return () => { cancelled = true }
  }, [id, blockedUserIds])

  const isConnected = connections.some(c => c.id === person?.id)
  const isSelf = person?.id === currentUser?.id
  const p = person?.privacy || {
    isPrivateProfile: false, showBio: true, showInterests: true,
    showCircles: true, showLocation: true, showAvailability: true
  }

  const isMasterPrivate = p.isPrivateProfile && !isConnected && !isSelf
  const showBio = p.showBio || isSelf
  const showInterests = p.showInterests || isSelf
  const hasBio = !!person?.bio?.trim()
  const hasInterests = !!(person?.interests && person.interests.length > 0)
  const showCircles = p.showCircles || isSelf
  const showLocation = p.showLocation || isSelf
  const showAvailability = (p.showAvailability !== false && isConnected) || isSelf

  const [connStats, setConnStats] = useState(null)

  useEffect(() => {
    if (!person || !currentUser || !isConnected || isSelf) return
    let cancelled = false
    const connection = connections.find(c => c.id === person.id)
    if (!connection) return

    // Since connections doesn't store connectedAt directly in context right now, we can use 
    // a placeholder or fetch it if needed. The migration implies it exists, but context
    // might just have user profiles. For now, we'll pass null or connected_at if present.
    // The RPC shared_meetup_count will do the heavy lifting for sharedMeetups.
    getConnectionStats({
      viewerId: currentUser.id,
      targetId: person.id,
      connectedAt: connection.connectedAt || null,
      lastHangout: connection.lastHangout || null,
    })
      .then(stats => {
        if (!cancelled) setConnStats(stats)
      })
      .catch(err => console.error('[UserProfile] connection stats failed', err))
    
    return () => { cancelled = true }
  }, [person, currentUser, isConnected, isSelf, connections])

  useEffect(() => {
    if (!person || !showAvailability || isMasterPrivate) return
    let cancelled = false
    setAvailabilityLoading(true)
    const now = new Date()
    const fromIso = now.toISOString()
    const toIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    
    getAvailabilityForUser(person.id, { fromIso, toIso })
      .then(data => {
        if (!cancelled) setAvailability(data)
      })
      .catch(err => console.error('[UserProfile] availability fetch failed', err))
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false)
      })
    return () => { cancelled = true }
  }, [person, showAvailability, isMasterPrivate])

  const daysData = useMemo(() => {
    if (!availability) return []
    const out = []
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() + i)
      const dayStart = new Date(d.setHours(0,0,0,0))
      const dayEnd = new Date(d.setHours(23,59,59,999))
      
      const dayBlocks = availability.filter(b => {
        const bs = new Date(b.startsAt)
        return bs >= dayStart && bs <= dayEnd
      })
      const freeSlots = computeFreeSlots(d, dayBlocks)
      out.push({
        date: new Date(d),
        busy: dayBlocks,
        free: freeSlots
      })
    }
    return out
  }, [availability])

  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  useEffect(() => {
    if (daysData.length > 0 && !availabilityLoading) {
      if (daysData[0].free.length === 0) {
        const nextFree = daysData.findIndex(d => d.free.length > 0)
        if (nextFree !== -1) {
          setSelectedDayIndex(nextFree)
        }
      }
    }
  }, [daysData, availabilityLoading])

  useEffect(() => {
    if (showMeetupModal) {
      if (suggestPrefill) {
        setMeetupDate(suggestPrefill.date || '')
        setMeetupTime(suggestPrefill.time || '12:00')
      } else {
        setMeetupDate(new Date().toISOString().split('T')[0])
      }
    } else {
      setSuggestPrefill(null)
    }
  }, [showMeetupModal, suggestPrefill])

  useEffect(() => {
    if (!showMeetupModal || !meetupDate || !meetupTime || !person) {
      setConflict(null)
      return
    }
    let cancelled = false
    setConflictChecking(true)
    const isoCombined = new Date(`${meetupDate}T${meetupTime}:00`).toISOString()
    
    checkConflictAt(person.id, isoCombined)
      .then(conf => {
        if (!cancelled) setConflict(conf)
      })
      .catch(err => {
        console.error('conflict check failed', err)
      })
      .finally(() => {
        if (!cancelled) setConflictChecking(false)
      })
      
    return () => { cancelled = true }
  }, [showMeetupModal, meetupDate, meetupTime, person])
  
  if (personLoading) {
    return <div style={{ padding:40, textAlign:'center', color:clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>Loading…</div>
  }
  if (!person) {
    return <div style={{ padding:40, textAlign:'center', color:clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>User not found.</div>
  }

  const isBlocked = !!(person?.id && blockedUserIds?.includes(person.id))

  return (
    <div style={{ minHeight:'100vh', backgroundColor:clr.bg, paddingBottom:100, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} aria-label="Go back" style={{ background:'none', border:'none', cursor:'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {!isSelf && (
          <button
            onClick={() => setShowActionMenu(!showActionMenu)}
            aria-label="More options"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" fill={clr.textDark} />
              <circle cx="12" cy="12" r="1.5" fill={clr.textDark} />
              <circle cx="12" cy="19" r="1.5" fill={clr.textDark} />
            </svg>
          </button>
        )}
      </div>

      <div style={{ padding: '24px 20px', textAlign:'center' }}>
        <img src={avatarFor(person)} alt={person.name} style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:`4px solid ${clr.white}`, boxShadow:'0 4px 14px rgba(0,0,0,0.1)' }} />
        <h1 style={{ fontSize:26, fontWeight:800, color:clr.textDark, margin:'12px 0 4px' }}>{person.name}</h1>
        {showLocation && <p style={{ fontSize:15, color:clr.textMid, margin:'0 0 16px' }}>{person.age}{person.city ? ` · ${person.city}` : ''}</p>}
        {!showLocation && person.age && <p style={{ fontSize:15, color:clr.textMid, margin:'0 0 16px' }}>{person.age}</p>}
        
        <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
          {isConnected ? (
            <>
              <button
                onClick={async () => {
                  try { const chatId = await startDM(person); navigate(`/chat/${chatId}`) }
                  catch (err) { console.error('[UserProfile] startDM failed', err) }
                }}
                style={{
                  padding: '10px 26px', borderRadius: 999, border: 'none',
                  background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                  color: '#FFFFFF', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
                }}
              >
                Message
              </button>
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                aria-label="Disconnect"
                style={{
                  padding: '10px 18px', borderRadius: 999,
                  border: '1.5px solid #FCA5A5',
                  background: clr.white, color: '#DC2626',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            </>
          ) : requestSent ? (
            <button disabled style={{ padding:'10px 26px', borderRadius:999, border:'none', background:'#10B981', color:'#FFFFFF', fontSize:15, fontWeight:700, cursor:'default', opacity:0.9 }}>
              Request Sent ✓
            </button>
          ) : (
            <button
              disabled={connecting || isSelf}
              onClick={async () => {
                setConnecting(true)
                try {
                  await connectWithPerson(person.id)
                  setRequestSent(true)
                } catch (err) {
                  console.error('[UserProfile] connect failed', err)
                  alert('Something went wrong. Please try again.')
                } finally {
                  setConnecting(false)
                }
              }}
              style={{ padding:'10px 26px', borderRadius:999, border:'none', background: connecting ? clr.indigoLt : (isSelf ? clr.border : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`), color: isSelf ? clr.textMid : '#FFFFFF', fontSize:15, fontWeight:700, cursor: (connecting || isSelf) ? 'default' : 'pointer', boxShadow: isSelf ? 'none' : '0 4px 14px rgba(91,95,239,0.3)', opacity: connecting ? 0.7 : 1, transition:'opacity 0.2s ease', display: isSelf ? 'none' : 'block' }}
            >
              {connecting ? 'Sending…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {isMasterPrivate ? (
        <div style={{ padding: '0 20px', textAlign: 'center', marginTop: 32 }}>
          <div style={{ backgroundColor: clr.white, borderRadius: 20, padding: 32, border: `1.5px dashed ${clr.border}` }}>
            <svg width="32" height="32" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: clr.textDark }}>This profile is private</h3>
            <p style={{ margin: 0, fontSize: 14, color: clr.textMid }}>Connect to see more about {person.name.split(' ')[0]}.</p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display:'flex', flexDirection:'column', gap:24 }}>
          {isConnected && connStats && !isSelf && (
            <section>
              <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>Connection</h3>
              <div style={{ backgroundColor:clr.white, padding:16, borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, padding: '4px 10px', borderRadius: 6, backgroundColor: connStats.status === 'New' ? '#FEF3C7' : connStats.status === 'Active' ? '#DCFCE7' : '#F3F4F6', color: connStats.status === 'New' ? '#D97706' : connStats.status === 'Active' ? '#059669' : '#4B5563', textTransform: 'uppercase' }}>
                      {connStats.status}
                    </span>
                    {connStats.daysConnected != null && (
                      <span style={{ fontSize: 14, color: clr.textMid }}>
                        {connStats.daysConnected < 30 ? `${connStats.daysConnected} days` : `${Math.floor(connStats.daysConnected / 30)} mo`}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const connection = connections.find(c => c.id === person.id)
                    const sinceDate = formatConnectionDate(connection?.connectedAt)
                    return sinceDate ? (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: clr.textMid, fontWeight: 500 }}>
                        Since {sinceDate}
                      </p>
                    ) : null
                  })()}
                  {connStats.streak > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Flame size={14} color="#EF4444" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
                        {connStats.streak} week{connStats.streak === 1 ? '' : ''} streak
                      </span>
                    </div>
                  )}
                  {connStats.sharedMeetups > 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: clr.textDark, fontWeight: 600 }}>
                      {connStats.sharedMeetups} shared meetup{connStats.sharedMeetups === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                {connStats.daysSinceHangout != null && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 12, color: clr.textLight, textTransform: 'uppercase', fontWeight: 800 }}>Last Hangout</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: clr.textDark, fontWeight: 700 }}>{connStats.daysSinceHangout}d ago</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {((showBio && hasBio) || (showInterests && hasInterests)) && (
            <section>
              <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>About</h3>
              <div style={{ backgroundColor:clr.white, padding:20, borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                {showBio && hasBio && <p style={{ fontSize:15, color:clr.textMid, lineHeight:1.6, margin:0 }}>{person.bio}</p>}
                {showInterests && hasInterests && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop: (showBio && hasBio) ? 16 : 0 }}>
                    {person.interests?.map(i => (
                      <span key={i} style={{ padding:'6px 14px', borderRadius:999, backgroundColor:clr.bg, color:clr.textDark, fontSize:13, fontWeight:600 }}>{i}</span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {showCircles && (
            <section>
              <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>Circles</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {personCircles.length === 0 ? <p style={{ fontSize:14, color:clr.textMid }}>Not in any public circles.</p> : personCircles.map(c => {
                  const cover = resolveCircleCover(c)
                  return (
                  <div key={c.id} onClick={() => navigate(`/circles/${c.id}`)} style={{ backgroundColor:clr.white, padding:16, borderRadius:20, display:'flex', alignItems:'center', gap:14, cursor:'pointer', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                    <div style={{ width:48, height:48, borderRadius:14, position: 'relative', overflow: 'hidden', display:'flex', alignItems:'center', justifyContent:'center', background: cover.kind === 'gradient' ? cover.value : undefined }}>
                      {cover.kind === 'image' && <img src={cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <CircleIcon circle={c} size={22} color="#FFFFFF" style={{ position: 'relative' }} />
                    </div>
                    <div>
                      <h4 style={{ margin:'0 0 2px', fontSize:15, fontWeight:700, color:clr.textDark }}>{c.name}</h4>
                      <p style={{ margin:0, fontSize:13, color:clr.textMid }}>{c.memberCount} members</p>
                    </div>
                  </div>
                )})}
              </div>
            </section>
          )}

          {showAvailability && (
            <section>
              <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>Availability</h3>
              {availabilityLoading ? (
                <p style={{ fontSize: 14, color: clr.textMid }}>Loading...</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    {daysData.map((dData, i) => {
                      const isSelected = selectedDayIndex === i
                      const hasFree = dData.free.length > 0
                      const dayStr = dData.date.toLocaleDateString('en-US', { weekday: 'short' })
                      const dateNum = dData.date.getDate()
                      
                      let bg = clr.white
                      let color = clr.textDark
                      let border = `1.5px solid ${clr.border}`
                      let shadow = 'none'

                      if (isSelected) {
                        bg = `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`
                        color = '#FFF'
                        border = '1.5px solid transparent'
                        shadow = '0 4px 14px rgba(91,95,239,0.3)'
                      } else if (hasFree) {
                        border = `1.5px solid ${clr.indigo}`
                      } else {
                        color = clr.textMid
                      }

                      return (
                        <div key={i} onClick={() => setSelectedDayIndex(i)} style={{ 
                          minWidth: 56, background: bg, borderRadius: 16, border, padding: '12px 8px', textAlign: 'center', boxShadow: shadow, flexShrink: 0, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' 
                        }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.9)' : clr.textMid, textTransform: 'uppercase' }}>{dayStr}</p>
                          <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color }}>{dateNum}</p>
                        </div>
                      )
                    })}
                  </div>

                  {daysData[selectedDayIndex] && (() => {
                    const dData = daysData[selectedDayIndex]
                    const dStr = dData.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    const isToday = selectedDayIndex === 0
                    const now = new Date()
                    const isPast9PM = isToday && now.getHours() >= 21
                    
                    return (
                      <div style={{ marginTop: 16, backgroundColor: clr.white, borderRadius: 20, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: clr.textDark }}>{dStr}</p>
                        
                        {dData.busy.length > 0 && (
                          <>
                            <p style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 8 }}>Busy</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {dData.busy.map((b, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: clr.indigo, flexShrink: 0 }} />
                                  <span style={{ fontSize: 14, fontWeight: 600, color: clr.textDark }}>{fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}</span>
                                  <span style={{ fontSize: 14, color: clr.textMid }}>·</span>
                                  <span style={{ fontSize: 14, color: clr.textMid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <p style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 8 }}>Free times</p>
                        {isPast9PM ? (
                          <p style={{ margin: 0, fontSize: 14, color: clr.textMid, fontStyle: 'italic' }}>Fully booked</p>
                        ) : dData.free.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 14, color: clr.textMid, fontStyle: 'italic' }}>Fully booked</p>
                        ) : (dData.busy.length === 0 && dData.free.length === 1 && new Date(dData.free[0].endsAt).getHours() - new Date(dData.free[0].startsAt).getHours() >= 12) ? (
                          <div 
                            onClick={() => openSuggestModal({ date: dData.date.toISOString().split('T')[0], time: '09:00' })}
                            className="free-chip"
                            style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${clr.border}`, background: clr.white, color: clr.indigo, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}
                          >
                            Free all day (9:00 AM – 9:00 PM)
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {dData.free.map((f, idx) => {
                              const dObj = new Date(f.startsAt)
                              const timeStr = `${String(dObj.getHours()).padStart(2, '0')}:${String(dObj.getMinutes()).padStart(2, '0')}`
                              return (
                                <div 
                                  key={idx} 
                                  onClick={() => openSuggestModal({ date: dData.date.toISOString().split('T')[0], time: timeStr })}
                                  className="free-chip"
                                  style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${clr.border}`, background: clr.white, color: clr.indigo, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}
                                >
                                  {fmtTime(f.startsAt)} – {fmtTime(f.endsAt)}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <button onClick={() => openSuggestModal()} style={{ marginTop: 12, width: '100%', padding: '14px', borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(91,95,239,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Calendar size={15} color="#FFFFFF" /> Suggest a Meetup
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {/* Suggest a Meetup Modal */}
      {showMeetupModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setShowMeetupModal(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 500, margin: '0 auto', backgroundColor: clr.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px 40px', zIndex: 1000, animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: clr.border, margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 20px 0', fontSize: 22, fontWeight: 800, color: clr.textDark }}>Suggest a time with {person.name.split(' ')[0]}</h3>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.textDark }}>Date</p>
                <input 
                  type="date" 
                  value={meetupDate} 
                  onChange={e => setMeetupDate(e.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, fontSize: 15, backgroundColor: clr.white, color: clr.textDark, outline: 'none' }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.textDark }}>Time</p>
              <TimePicker value={meetupTime} onChange={setMeetupTime} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.textDark }}>Location (Optional)</p>
              <input 
                type="text"
                placeholder="e.g. Blue Bottle Coffee"
                value={meetupLocation} 
                onChange={e => setMeetupLocation(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, fontSize: 15, backgroundColor: clr.white, color: clr.textDark, outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.textDark }}>Note (Optional)</p>
              <textarea 
                placeholder="Let's grab a coffee!"
                value={meetupNote} 
                onChange={e => setMeetupNote(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, fontSize: 15, minHeight: 80, resize: 'none', backgroundColor: clr.white, color: clr.textDark, outline: 'none' }}
              />
            </div>

            {/* Conflict checking UI */}
            {meetupDate && meetupTime && (
              <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, backgroundColor: conflict ? '#FEF3C7' : '#DCFCE7', color: conflict ? '#D97706' : '#059669', fontSize: 14, fontWeight: 600 }}>
                {conflictChecking ? 'Checking availability...' : conflict ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} color="#D97706" /> {person.name.split(' ')[0]} has "{conflict.title}" then — send anyway?</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle size={15} color="#059669" /> {person.name.split(' ')[0]} is free</span>}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowMeetupModal(false)} style={{ flex: 1, padding: '16px', borderRadius: 999, border: `1.5px solid ${clr.border}`, backgroundColor: clr.white, color: clr.textDark, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button 
                disabled={!meetupDate || !meetupTime}
                onClick={async () => {
                  try {
                    const chatId = await startDM(person)
                    const d = new Date(`${meetupDate}T${meetupTime}:00`)
                    const humanDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    const humanTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    const msg = `📅 Hey ${person.name.split(' ')[0]}, want to meet up on ${humanDate} at ${humanTime}${meetupLocation ? ` at ${meetupLocation}` : ''}?${meetupNote ? `\n\n${meetupNote}` : ''}`
                    await sendMessage(chatId, msg)
                    setShowMeetupModal(false)
                    navigate(`/chat/${chatId}`)
                  } catch (err) {
                    console.error('send suggestion failed', err)
                    alert('Could not send suggestion. Please try again.')
                  }
                }}
                style={{ flex: 2, padding: '16px', borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color: '#FFF', fontSize: 16, fontWeight: 800, cursor: (!meetupDate || !meetupTime) ? 'not-allowed' : 'pointer', opacity: (!meetupDate || !meetupTime) ? 0.6 : 1, boxShadow: '0 8px 20px rgba(91,95,239,0.25)' }}
              >
                Send Suggestion
              </button>
            </div>
          </div>
        </>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div
          onClick={() => !disconnecting && setShowDisconnectConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              backgroundColor: clr.white, borderRadius: 24,
              padding: '28px 24px', textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            <Users size={40} color={clr.indigo} style={{ marginBottom: 8 }} />
            <h3 style={{
              margin: '0 0 8px', fontSize: 20, fontWeight: 800,
              color: clr.textDark,
              fontFamily: "'DM Serif Display','Georgia',serif",
            }}>
              Disconnect from {person.name.split(' ')[0]}?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: clr.textMid, lineHeight: 1.5 }}>
              They'll be removed from your connections and you'll lose connection-only access
              to their availability and profile. Your chat history will stay.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={disconnecting}
                style={{
                  flex: 1, padding: 14, borderRadius: 999,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white, color: clr.textDark,
                  fontSize: 15, fontWeight: 700,
                  cursor: disconnecting ? 'wait' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDisconnecting(true)
                  try {
                    await disconnectFromPerson(person.id)
                    setShowDisconnectConfirm(false)
                  } catch (err) {
                    console.error('[UserProfile] disconnect failed', err)
                    alert('Something went wrong. Please try again.')
                  } finally {
                    setDisconnecting(false)
                  }
                }}
                disabled={disconnecting}
                style={{
                  flex: 1, padding: 14, borderRadius: 999, border: 'none',
                  background: disconnecting ? '#FCA5A5' : '#DC2626',
                  color: '#FFFFFF', fontSize: 15, fontWeight: 700,
                  cursor: disconnecting ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
                }}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .free-chip:hover { background: ${clr.indigoLt} !important; }
      `}
      </style>
      {/* Overflow Action Menu */}
      {showActionMenu && (
        <div
          onClick={() => setShowActionMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            backgroundColor: 'rgba(15,15,30,0.4)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 500,
              backgroundColor: clr.white,
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideUp 0.25s ease-out forwards',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{ width: 36, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
            </div>

            <button
              onClick={() => {
                setShowActionMenu(false)
                setShowReportModal(true)
              }}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 14,
                border: 'none',
                backgroundColor: clr.bg,
                color: clr.textDark,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Flag size={15} color={clr.textDark} /> Report {person?.name ? person.name.split(' ')[0] : 'User'}
            </button>

            {isBlocked ? (
              <button
                onClick={async () => {
                  setShowActionMenu(false)
                  try {
                    await unblockUserById(person.id)
                  } catch (err) {
                    console.error('[UserProfile] unblock failed', err)
                  }
                }}
                style={{
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 14,
                  border: 'none',
                  backgroundColor: clr.indigoLt,
                  color: clr.indigo,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Unlock size={15} color={clr.indigo} /> Unblock {person?.name ? person.name.split(' ')[0] : 'User'}
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowActionMenu(false)
                  setShowBlockConfirm(true)
                }}
                style={{
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 14,
                  border: 'none',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ban size={15} color="#DC2626" /> Block {person?.name ? person.name.split(' ')[0] : 'User'}
              </button>
            )}

            <button
              onClick={() => setShowActionMenu(false)}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 14,
                border: `1.5px solid ${clr.border}`,
                backgroundColor: clr.white,
                color: clr.textMid,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div
          onClick={() => setShowBlockConfirm(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(15,15,30,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: clr.white,
              borderRadius: 24,
              padding: '24px 20px',
              boxSizing: 'border-box',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Ban size={32} color="#DC2626" /></div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 20, fontWeight: 800, color: clr.textDark, textAlign: 'center' }}>
              Block {person?.name}?
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: clr.textMid, lineHeight: 1.5, textAlign: 'center' }}>
              Block {person?.name}? They won't be able to see your profile, message you, or find you in Third Space. You won't see them either. Any existing connection will be removed.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowBlockConfirm(false)}
                disabled={blocking}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 999,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white,
                  color: clr.textDark,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blocking}
                onClick={async () => {
                  setBlocking(true)
                  try {
                    await blockUserById(person.id)
                    setShowBlockConfirm(false)
                    navigate(-1)
                  } catch (err) {
                    console.error('[UserProfile] block user failed', err)
                    setBlocking(false)
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: blocking ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
                }}
              >
                {blocking ? 'Blocking...' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={person?.id}
        subjectName={person?.name}
      />
    </div>
  )
}
