import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCircle, updateCircle } from '../lib/circles'
import { listEventsForCircle } from '../lib/events'
import { useAppContext } from '../context/AppContext.jsx'
import EventDetailModal from '../components/EventDetailModal.jsx'
import HoopApplication from '../components/hoops/HoopApplication.jsx'
import OrganizerReview from '../components/hoops/OrganizerReview.jsx'
import { useChatMessages } from '../hooks/useChatMessages.js'
import { listChannels, createChannel as createChannelApi } from '../lib/chat.js'
import { avatarFor } from '../lib/avatar'
import { resolveCircleCover } from '../lib/circleCover'
import { uploadCircleCover, deleteCircleCover } from '../lib/storage'
import ImageUploader from '../components/ui/ImageUploader.jsx'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  teal: '#0D9488',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'members', label: 'Members' },
  { id: 'events', label: 'Events' },
  { id: 'chat', label: 'Chat' },
]

const VIBE_ICONS = {
  'Beginner Friendly': '😊',
  'Weekly Meetups': '📅',
  'Outdoors': '🏔️',
  'All Levels': '⭐',
  'Casual': '☕',
  'Professional': '💼',
}

export default function CircleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [circle, setCircle] = useState(null)
  const [circleLoading, setCircleLoading] = useState(true)
  const [circleError, setCircleError] = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setCircleLoading(true)
    Promise.all([
      getCircle(id),
      listEventsForCircle(id)
    ])
      .then(([c, evts]) => {
        if (!cancelled && c) {
          c.events = evts
          setCircle(c)
          setCircleError(null)
        }
      })
      .catch(err => { if (!cancelled) setCircleError(err) })
      .finally(() => { if (!cancelled) setCircleLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const { currentUser, pendingApplications, joinedCircles, joinCircle, leaveCircle, rsvpEvent, cancelRsvp, isRsvpd, chatState, sendMessage, markChatRead, startDM, connections } = useAppContext()
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
  const [showCoverUploader, setShowCoverUploader] = useState(false)
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

  const isJoined = circle ? joinedCircles.includes(circle.id) : false
  const isPrivate = circle ? circle.type === 'private' : false
  const isOrganizer = circle ? circle.organizerId === currentUser?.id : false
  const hasHoops = circle ? !!circle.hoops?.length : false
  const pendingApp = circle ? pendingApplications?.find(a => a.circleId === circle.id && a.applicantId === currentUser?.id && a.status === 'pending') : null
  const cover = resolveCircleCover(circle)

  const dynamicTabs = useMemo(() => {
    const base = [...TABS]
    if (isOrganizer) base.push({ id: 'applications', label: 'Applications' })
    return base
  }, [isOrganizer])

  if (circleLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: clr.textMid }}>Loading…</div>
  }
  if (!circle) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: clr.textMid, fontFamily: "'DM Sans',sans-serif" }}>
        Circle not found.
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans','Inter',sans-serif",
      paddingBottom: 100,
    }}>

      {/* ── Hero banner ── */}
      <div style={{
        background: cover.kind === 'gradient' ? cover.value : undefined,
        paddingBottom: 56,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {cover.kind === 'image' && (
          <>
            <img src={cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,23,42,0.15) 40%, rgba(15,23,42,0.6) 100%)' }} />
          </>
        )}
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 0',
          position: 'relative',
          zIndex: 2,
        }}>
          <button type="button" onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <svg width="22" height="22" fill="none" stroke="#FFFFFF" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
            {circle.name} {circle.emoji}
          </span>
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowDropdown(!showDropdown)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1" fill="#FFFFFF" />
                <circle cx="12" cy="12" r="1" fill="#FFFFFF" />
                <circle cx="12" cy="19" r="1" fill="#FFFFFF" />
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
                {isOrganizer && (
                  <button type="button" onClick={() => { setShowDropdown(false); setShowCoverUploader(true) }} style={{ width: '100%', padding: '10px 12px', backgroundColor: 'transparent', border: 'none', borderRadius: 8, textAlign: 'left', color: clr.textDark, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Change cover photo
                  </button>
                )}
                {isOrganizer && !!circle?.coverImageUrl && (
                  <button type="button" onClick={async () => {
                    try {
                      await deleteCircleCover(circle.id)
                      await updateCircle(circle.id, { coverImageUrl: null })
                      setCircle(c => ({ ...c, coverImageUrl: '' }))
                    } catch (err) {
                      console.error('[CircleDetail] remove cover failed', err)
                    } finally { setShowDropdown(false) }
                  }} style={{ width: '100%', padding: '10px 12px', backgroundColor: 'transparent', border: 'none', borderRadius: 8, textAlign: 'left', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Remove cover photo
                  </button>
                )}
                {!isOrganizer && (
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
                )}
              </div>
            )}
          </div>
        </div>

        {isOrganizer && (
          <button type="button" onClick={() => setShowCoverUploader(true)} style={{ position: 'absolute', top: 66, right: 20, zIndex: 3, border: 'none', borderRadius: 999, padding: '8px 12px', background: 'rgba(15,23,42,0.45)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📷 Change cover
          </button>
        )}

        {/* Circle icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 20, position: 'relative', zIndex: 2 }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>
              {circle.emoji ?? '⭕'}
            </div>
          </div>
        </div>

        {/* Circle name + status */}
        <div style={{ textAlign: 'center', padding: '0 20px', position: 'relative', zIndex: 2 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: '#FFFFFF',
            margin: '0 0 12px 0', letterSpacing: '-0.02em',
            fontFamily: "'DM Serif Display','Georgia',serif",
          }}>
            {circle.name}
          </h1>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            backgroundColor: clr.teal,
            borderRadius: 999, padding: '5px 16px',
            fontSize: 11, fontWeight: 700, color: '#FFFFFF',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Active
          </div>
        </div>

        {/* Join button — floats over the bottom of the hero */}
        <div style={{
          position: 'absolute', bottom: -22,
          left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          {isJoined ? (
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              style={{
                padding: '12px 40px',
                borderRadius: 999,
                border: 'none',
                background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                color: '#FFF',
                fontSize: 16, fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(91,95,239,0.3)',
              }}
            >
              Open Chat
            </button>
          ) : pendingApp ? (
            <button
              type="button"
              disabled
              style={{
                padding: '12px 40px', borderRadius: 999, border: 'none',
                backgroundColor: clr.white, color: clr.textMid,
                fontSize: 16, fontWeight: 700, cursor: 'not-allowed',
                boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
              }}
            >
              ⏳ Pending Review
            </button>
          ) : hasHoops ? (
            <button
              type="button"
              onClick={() => setShowHoopApp(true)}
              style={{
                padding: '12px 40px', borderRadius: 999, border: 'none',
                backgroundColor: clr.white, color: clr.indigo,
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
              }}
            >
              Apply to Join 🏀
            </button>
          ) : (
            <button
              type="button"
              onClick={() => joinCircle(circle.id)}
              style={{
                padding: '12px 40px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: clr.white,
                color: clr.indigo,
                fontSize: 16, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
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
        marginTop: 0, paddingTop: 32,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {dynamicTabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 22px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: active ? 700 : 500,
                  color: active ? clr.indigo : clr.textMid,
                  borderBottom: active ? `2.5px solid ${clr.indigo}` : '2.5px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: '20px 16px', margin: '0 auto' }}>

        {/* ABOUT */}
        {activeTab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Entry Requirements */}
            {hasHoops && (
              <div style={{
                backgroundColor: clr.white, borderRadius: 20,
                padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 12px 0' }}>Entry Requirements</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(circle.hoops || []).map((h, i) => (
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
              backgroundColor: clr.white, borderRadius: 20,
              padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 12px 0' }}>Description</h3>
              <p style={{ fontSize: 15, color: clr.textMid, lineHeight: 1.7, margin: 0 }}>{circle.description}</p>
            </div>

            {/* Circle Vibe */}
            <div style={{
              backgroundColor: clr.white, borderRadius: 20,
              padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 14px 0' }}>Circle Vibe</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {(circle.vibes ?? circle.vibe?.split(',').map(v => v.trim()) ?? []).map((v) => (
                  <span key={v} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 999,
                    border: `1.5px solid ${clr.border}`,
                    backgroundColor: clr.white,
                    fontSize: 14, color: clr.textDark, fontWeight: 500,
                  }}>
                    <span>{VIBE_ICONS[v] ?? '✨'}</span> {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Organizer */}
            <div style={{
              backgroundColor: clr.white, borderRadius: 20,
              padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 14px 0' }}>Organizer</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={avatarFor(circle.organizer)}
                      alt={circle.organizer?.name}
                      style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 18, height: 18, borderRadius: '50%',
                      backgroundColor: clr.indigo,
                      border: `2px solid ${clr.white}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="9" height="9" fill="none" stroke="#FFFFFF" strokeWidth="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, margin: 0 }}>
                      {circle.organizer?.name}
                    </p>
                    <p style={{ fontSize: 13, color: clr.indigo, margin: 0, fontWeight: 500 }}>
                      {circle.organizer?.role ?? 'Organizer'}
                    </p>
                  </div>
                </div>
                <button type="button" style={{
                  padding: '10px 22px', borderRadius: 999,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white,
                  fontSize: 14, fontWeight: 600, color: clr.textDark,
                  cursor: 'pointer',
                }}>
                  Message
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { value: circle.memberCount ?? (circle.members || []).length ?? 0, label: 'MEMBERS' },
                { value: (circle.events || []).length ?? 0, label: 'UPCOMING' },
              ].map(({ value, label }) => (
                <div key={label} style={{
                  backgroundColor: clr.white, borderRadius: 20,
                  padding: '18px 12px', textAlign: 'center',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color: clr.indigo, margin: '0 0 4px 0' }}>{value}</p>
                  <p style={{ fontSize: 11, color: clr.textMid, margin: 0, letterSpacing: '0.08em', fontWeight: 600 }}>{label}</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(circle.members || []).map((member) => (
                  <div key={member.id} onClick={() => navigate(`/user/${member.id}`)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: clr.bg, borderRadius: 14,
                    padding: '10px 12px', cursor: 'pointer'
                  }}>
                    <img src={avatarFor(member)} alt={member.name} style={{
                      width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: clr.textDark,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(!(circle.events || []).length) ? (
              <p style={{ fontSize: 14, color: clr.textMid, padding: 20 }}>No upcoming events yet.</p>
            ) : (circle.events || []).map((event) => {
              const going = isRsvpd(event.id)
              return (
                <div key={event.id} onClick={() => openEventDetail(event)} style={{
                  backgroundColor: clr.white, borderRadius: 20,
                  padding: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  cursor: 'pointer',
                }}>
                  {/* Date block */}
                  <div style={{
                    width: 52, flexShrink: 0, textAlign: 'center',
                    backgroundColor: going ? '#DCFCE7' : clr.indigoLt, borderRadius: 14, padding: '10px 6px',
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: going ? '#059669' : clr.indigo, margin: 0, lineHeight: 1 }}>
                      {event.date?.split(' ')[1] ?? event.date?.split('-')[2] ?? '—'}
                    </p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: going ? '#059669' : clr.indigo, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {event.date?.split(' ')[0] ?? 'Mar'}
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: clr.textDark, margin: '0 0 4px 0' }}>{event.title}</p>
                    <p style={{ fontSize: 12, color: clr.textMid, margin: 0 }}>{event.time} · {event.location}</p>
                  </div>
                  {going ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); cancelRsvp(event.id); }} style={{
                      padding: '9px 18px', borderRadius: 999, border: 'none',
                      background: '#FEE2E2',
                      color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      flexShrink: 0,
                    }}>
                      Cancel
                    </button>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEventDetail(event); }} style={{
                      padding: '9px 18px', borderRadius: 999, border: 'none',
                      background: `linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
                      color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      flexShrink: 0,
                    }}>
                      Details
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* CHAT — Discord-style inline experience */}
        {activeTab === 'chat' && (
          <CircleChatPanel
            circle={circle}
            chatState={chatState}
            sendMessage={sendMessage}
            markChatRead={markChatRead}
            currentUser={currentUser}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
          />
        )}

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
              {connections
                .filter(p => p.name.toLowerCase().includes(inviteSearch.toLowerCase()))
                .slice(0, 10)
                .map(p => {
                  const alreadyMember = circle.members?.some(m => m.id === p.id)
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${clr.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={avatarFor(p)} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: clr.textDark }}>{p.name}</span>
                      </div>
                      <button
                        disabled={alreadyMember}
                        onClick={async () => {
                          try {
                            const chatId = await startDM(p)
                            await sendMessage(chatId, `Hey ${p.name.split(' ')[0]}! I think you'd love this circle: ${circle.name}. You should check it out! 🌟`)
                            setShowInviteModal(false)
                            setInviteSearch('')
                            setToastMsg(`Invite sent to ${p.name}!`)
                            setTimeout(() => setToastMsg(null), 2500)
                          } catch (err) {
                            console.error('[CircleDetail] startDM failed', err)
                          }
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

      {showCoverUploader && isOrganizer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowCoverUploader(false)}>
          <div style={{ width: '100%', maxWidth: 560, background: clr.white, borderRadius: 18, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 12px', fontSize: 16, color: clr.textDark }}>Update cover photo</h4>
            <ImageUploader
              shape="cover"
              currentUrl={circle?.coverImageUrl || null}
              fallback={<div style={{ width: '100%', height: '100%', background: cover.kind === 'gradient' ? cover.value : 'var(--bg)' }} />}
              onUpload={(file) => uploadCircleCover({ circleId: circle.id, file })}
              onChange={async (newUrl) => {
                try {
                  await updateCircle(circle.id, { coverImageUrl: newUrl })
                  setCircle(c => ({ ...c, coverImageUrl: newUrl }))
                  setShowCoverUploader(false)
                } catch (err) {
                  console.error('[CircleDetail] update cover failed', err)
                }
              }}
              onRemove={async () => {
                await deleteCircleCover(circle.id)
                await updateCircle(circle.id, { coverImageUrl: null })
                setCircle(c => ({ ...c, coverImageUrl: '' }))
              }}
            />
          </div>
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


/* ── Discord-style circle chat panel ── */
function CircleChatPanel({ circle, chatState, sendMessage, markChatRead, currentUser, activeChannel, setActiveChannel }) {
  const groupChat = Object.values(chatState || {}).find(c => c.circleId === circle.id)
  const chatId = groupChat?.id || null

  const [channels, setChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [chatInput, setChatInput] = useState('')
  const msgsEndRef = useRef(null)

  // Fetch channels for this chat
  useEffect(() => {
    if (!chatId) { setChannelsLoading(false); return }
    let cancelled = false
    setChannelsLoading(true)
    listChannels(chatId)
      .then(list => { if (!cancelled) setChannels(list) })
      .catch(err => console.error('[CircleChatPanel] listChannels', err))
      .finally(() => { if (!cancelled) setChannelsLoading(false) })
    return () => { cancelled = true }
  }, [chatId])

  // Resolve the active channel slug → UUID
  const resolvedChannelId = useMemo(() => {
    if (!activeChannel || activeChannel === 'general') {
      // "general" is the default channel
      const gen = channels.find(c => c.name === 'general')
      return gen?.id || null
    }
    return channels.find(c => c.name === activeChannel)?.id || null
  }, [activeChannel, channels])

  // Subscribe to real-time messages via hook
  const { messages, loading: msgsLoading } = useChatMessages({
    chatId,
    channelId: resolvedChannelId,
  })

  // Mark read when viewing
  useEffect(() => {
    if (chatId) markChatRead(chatId)
  }, [chatId, activeChannel, markChatRead])

  // Auto-scroll
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send handler
  const handleSend = useCallback((e) => {
    e.preventDefault()
    if (!chatInput.trim() || !chatId) return
    sendMessage(chatId, chatInput, resolvedChannelId)
    setChatInput('')
  }, [chatInput, chatId, resolvedChannelId, sendMessage])

  // Create channel handler
  const handleCreateChannel = useCallback(async (e) => {
    e.preventDefault()
    const slug = newChannelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug || !chatId) return
    if (channels.some(c => c.name === slug)) { setShowNewChannel(false); setNewChannelName(''); return }
    try {
      const newCh = await createChannelApi(chatId, slug)
      if (newCh) {
        setChannels(prev => [...prev, newCh])
        setActiveChannel(newCh.name)
      }
    } catch (err) {
      console.error('[CircleChatPanel] createChannel', err)
    }
    setShowNewChannel(false)
    setNewChannelName('')
  }, [newChannelName, chatId, channels, setActiveChannel])

  if (!groupChat) {
    return (
      <div style={{
        backgroundColor: '#1E1F2B', borderRadius: 20, padding: 40,
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        textAlign: 'center', minHeight: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ fontSize: 15, color: '#8B8FA3' }}>
          Join this circle to access the group chat.
        </p>
      </div>
    )
  }

  const dk = {
    panel: '#1E1F2B',
    channelBar: '#181922',
    msgArea: '#23243A',
    inputBar: '#181922',
    inputBg: '#2A2B3D',
    inputBorder: '#363849',
    text: '#E2E4F0',
    textMuted: '#8B8FA3',
    textFaint: '#5C5F73',
    otherBubble: '#2A2B3D',
    activeCh: '#5B5FEF',
    inactiveCh: 'transparent',
  }

  return (
    <div style={{
      backgroundColor: dk.panel, borderRadius: 20,
      boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column', height: 520,
      overflow: 'hidden',
    }}>
      {/* ── Channel bar ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto', scrollbarWidth: 'none',
        backgroundColor: dk.channelBar,
        alignItems: 'center',
      }}>
        {channelsLoading ? (
          <span style={{ fontSize: 13, color: dk.textMuted, padding: '6px 0' }}>Loading…</span>
        ) : (
          channels.map(ch => {
            const isActive = activeChannel === ch.name
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.name)}
                style={{
                  padding: '7px 14px', borderRadius: 10, border: 'none',
                  backgroundColor: isActive ? dk.activeCh : dk.inactiveCh,
                  color: isActive ? '#fff' : dk.textMuted,
                  fontSize: 13, fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.45, fontSize: 14 }}>#</span>
                {ch.name}
              </button>
            )
          })
        )}

        {/* Add channel */}
        {showNewChannel ? (
          <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexShrink: 0 }}>
            <input
              autoFocus
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onBlur={() => setTimeout(() => setShowNewChannel(false), 200)}
              placeholder="new-channel"
              style={{
                padding: '7px 12px', borderRadius: 10,
                border: `1.5px solid ${dk.activeCh}`,
                backgroundColor: dk.inputBg, color: dk.text,
                fontSize: 13, fontWeight: 600, outline: 'none', width: 110,
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowNewChannel(true)}
            style={{
              padding: '7px 12px', borderRadius: 10,
              border: `1.5px dashed ${dk.inputBorder}`,
              backgroundColor: 'transparent', color: dk.textFaint,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          </button>
        )}
      </div>

      {/* ── Messages area ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
        backgroundColor: dk.msgArea,
      }}>
        {msgsLoading ? (
          <div style={{ margin: 'auto', color: dk.textMuted, fontSize: 14 }}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center' }}>
            <p style={{ fontSize: 24, margin: '0 0 8px' }}>💬</p>
            <p style={{ color: dk.textMuted, fontSize: 14, margin: 0 }}>
              No messages in <strong style={{ color: dk.text }}>#{activeChannel}</strong> yet. Be the first!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, marginLeft: 4 }}>
                    {msg.senderAvatar && (
                      <img src={msg.senderAvatar} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                    )}
                    <span style={{ fontSize: 11, color: dk.textMuted, fontWeight: 600 }}>{msg.senderName}</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  backgroundColor: isMe ? dk.activeCh : dk.otherBubble,
                  color: isMe ? '#FFFFFF' : dk.text,
                  fontSize: 14, lineHeight: 1.5,
                  boxShadow: isMe ? '0 4px 14px rgba(91,95,239,0.3)' : '0 2px 6px rgba(0,0,0,0.15)',
                }}>
                  {msg.text}
                </div>
                <span style={{ fontSize: 10, color: dk.textFaint, marginTop: 3, marginLeft: 4, marginRight: 4 }}>
                  {msg.time ?? ''}
                </span>
              </div>
            )
          })
        )}
        <div ref={msgsEndRef} />
      </div>

      {/* ── Input bar ── */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: 10, padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: dk.inputBar,
      }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder={`Message #${activeChannel}…`}
          style={{
            flex: 1, padding: '11px 16px', borderRadius: 999,
            border: `1.5px solid ${dk.inputBorder}`,
            backgroundColor: dk.inputBg,
            fontSize: 14, color: dk.text,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button type="submit" style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: `linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 4px 12px rgba(91,95,239,0.35)',
        }}>
          <svg width="17" height="17" fill="none" stroke="#FFFFFF" strokeWidth="2.2" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  )
}
