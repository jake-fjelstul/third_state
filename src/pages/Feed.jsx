import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import ProfileCompletionCard from '../components/feed/ProfileCompletionCard.jsx'
import { profileCompleteness } from '../lib/profileCompleteness.jsx'
import { listUpcomingEvents, expandRecurrence, updateEvent } from '../lib/events'
import { uploadEventCover, uploadCircleCover } from '../lib/storage'
import { listCircles, updateCircle } from '../lib/circles'
import { listProfiles } from '../lib/profiles'
import HoopBuilder from '../components/hoops/HoopBuilder.jsx'
import SwipeDiscovery from '../components/discovery/SwipeDiscovery.jsx'
import EventDetailModal from '../components/EventDetailModal.jsx'
import CreateWheel from '../components/CreateWheel.jsx'
import TimePicker from '../components/TimePicker.jsx'
import { avatarFor } from '../lib/avatar'
import OnboardingModal from '../components/feed/OnboardingModal.jsx'
import { listBatteryHistory, relativeTime } from '../lib/battery.js'
import LocationAutocomplete from '../components/ui/LocationAutocomplete.jsx'
import { buildMapsUrl } from '../lib/geocoding.js'
import AssistantBar from '../components/feed/AssistantBar.jsx'
import AssistantModal from '../components/assistant/AssistantModal.jsx'
import { checkContent } from '../lib/contentFilter.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  amber: '#F59E0B',
  green: 'var(--green)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

const TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'circles', label: 'Circles' },
  { id: 'events', label: 'Events' },
]

const CIRCLE_COLORS = [
  { bg: '#EEF0FF', accent: '#5B5FEF' },
  { bg: '#FEF3C7', accent: '#D97706' },
  { bg: '#D1FAE5', accent: '#059669' },
  { bg: '#FFE4E6', accent: '#E11D48' },
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
      flexShrink: 0, width: 170,
      backgroundColor: clr.white,
      borderRadius: 20, padding: '16px 14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      cursor: 'pointer'
    }}>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <img src={avatarFor(person)} alt={person.name} style={{
          width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
        }} />
        {person.online && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 12, height: 12, borderRadius: '50%',
            backgroundColor: clr.green, border: `2px solid ${clr.white}`,
          }} />
        )}
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: '0 0 2px 0' }}>
        {person.name.split(' ')[0]}
        <span style={{ fontSize: 12, fontWeight: 400, color: clr.textLight }}> {person.age}</span>
      </p>
      <p style={{
        fontSize: 12, color: clr.textMid, margin: '0 0 10px 0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%'
      }}>
        {person.bio?.slice(0, 36)}…
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
        {person.interests?.slice(0, 2).map(i => (
          <span key={i} style={{
            fontSize: 10, fontWeight: 600, color: clr.indigo,
            backgroundColor: clr.indigoLt, padding: '3px 8px', borderRadius: 999,
          }}>{i}</span>
        ))}
      </div>
      <button type="button"
        onClick={async (e) => {
          e.stopPropagation()
          try {
            const chatId = await startDM(person)
            navigate(`/chat/${chatId}`)
          } catch (err) {
            console.error('[Feed.PersonCard] startDM failed', err)
          }
        }}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 999,
          border: `1.5px solid ${clr.indigo}`,
          backgroundColor: clr.white,
          color: clr.indigo, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
        backgroundColor: clr.white, borderRadius: 20,
        padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        transition: 'transform 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        backgroundColor: accent.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
      }}>
        {circle.emoji ?? '⭕'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <span style={{
            fontSize: 15, fontWeight: 700, color: clr.textDark,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {circle.name}
          </span>
          {isPrivate && (
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: accent.accent,
            backgroundColor: accent.bg, padding: '2px 8px', borderRadius: 999
          }}>
            {circle.interestTag}
          </span>
          <span style={{ fontSize: 11, color: clr.textLight }}>
            {circle.memberCount ?? (circle.members || []).length ?? 0} members
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onJoin() }}
        style={{
          flexShrink: 0, padding: '8px 14px', borderRadius: 999,
          border: isJoined ? 'none' : `1.5px solid ${clr.indigo}`,
          backgroundColor: isJoined ? clr.indigoLt : clr.white,
          color: clr.indigo, fontSize: 12, fontWeight: 700,
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
      flexShrink: 0, width: 220,
      backgroundColor: clr.white,
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      cursor: 'pointer',
    }}>
      {/* Gradient header */}
      <div style={{
        height: 72,
        background: EVENT_GRADIENTS[idx % EVENT_GRADIENTS.length],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 28 }}>{event.emoji ?? '📅'}</span>
      </div>
      <div style={{ padding: '14px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: clr.textDark, margin: '0 0 6px 0', lineHeight: 1.3 }}>
          {event.title}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: 12, color: clr.textMid }}>{event.date} · {event.time}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{
              fontSize: 12, color: clr.textMid,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {event.location}
            </span>
          </div>
        </div>
        {/* Attendee stack */}
        {event.attendees?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <div style={{ display: 'flex' }}>
              {event.attendees.slice(0, 3).map((a, i) => (
                <img key={i} src={avatarFor(a)} alt=""
                  style={{
                    width: 22, height: 22, borderRadius: '50%', objectFit: 'cover',
                    border: `2px solid ${clr.white}`, marginLeft: i === 0 ? 0 : -8
                  }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: clr.textLight }}>
              {event.attendees.length}+ going
            </span>
          </div>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onViewDetails?.(event); }} style={{
          width: '100%', padding: '9px 0', borderRadius: 999, border: 'none',
          background: rsvpd ? clr.indigoLt : `linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
          color: rsvpd ? clr.indigo : '#FFFFFF',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: rsvpd ? 'none' : '0 4px 12px rgba(91,95,239,0.3)',
          transition: 'all 0.2s ease',
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
    <div style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px' }}>
      <div style={{ display: 'flex', gap: 12, padding: '4px 16px' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Up Next Card ── */
function UpNextCard({ meetup, idx, onViewDetails }) {
  const accents = ['#5B5FEF', '#0D9488', '#F59E0B', '#E11D48']
  const accent = accents[idx % accents.length]

  const getUrgency = (dateStr) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const safeStr = dateStr?.includes('-') && !dateStr.includes('T') ? dateStr.replace(/-/g, '/') : dateStr
    const meetDate = new Date(safeStr); meetDate.setHours(0, 0, 0, 0)
    const diff = Math.round((meetDate - today) / 86400000)

    if (diff === 0) return { label: 'Today', amber: true }
    if (diff === 1) return { label: 'Tomorrow', amber: true }
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
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: '0 0 4px 0' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{subtitle}</p>}
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

function CreateModals({ show, onClose, onShowToast, people, connections, refreshCircles }) {
  const navigate = useNavigate()
  const { joinedCircles, startDM, sendMessage, createEventAndRsvp, currentUser, discoverySwipes, createCircle, blockedUserIds } = useAppContext()
  const [coffeeSearch, setCoffeeSearch] = useState('')
  const [coffeeTarget, setCoffeeTarget] = useState(null)
  const [circlePrivacy, setCirclePrivacy] = useState('open')
  const [eventTime, setEventTime] = useState('18:00')
  const [coffeeTime, setCoffeeTime] = useState('10:00')
  const [coffeeDate, setCoffeeDate] = useState('')
  const [coffeeNote, setCoffeeNote] = useState('')
  const [hoopsEnabled, setHoopsEnabled] = useState(false)
  const [circleHoops, setCircleHoops] = useState([])
  const [circles, setCircles] = useState([])

  const [eventLocation, setEventLocation] = useState(null)
  const [coffeeLocation, setCoffeeLocation] = useState(null)
  const [lfgLocation, setLfgLocation] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [selectedCircleEmoji, setSelectedCircleEmoji] = useState('✨')
  const [recurrenceRule, setRecurrenceRule] = useState('none')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  const biasNear = (currentUser?.latitude != null && currentUser?.longitude != null)
    ? { lat: currentUser.latitude, lng: currentUser.longitude }
    : undefined
  const [swipeStack, setSwipeStack] = useState(() => {
    const unjoined = circles.filter(c => !joinedCircles.includes(c.id))
    const unseen = unjoined.slice(discoverySwipes.circle)
    return unseen.length ? unseen : unjoined // cycle back if empty
  })

  // Keep swipe stack updated when circles load
  useEffect(() => {
    const unjoined = circles.filter(c => !joinedCircles.includes(c.id))
    const unseen = unjoined.slice(discoverySwipes.circle)
    setSwipeStack(unseen.length ? unseen : unjoined)
  }, [circles, joinedCircles, discoverySwipes.circle])

  useEffect(() => {
    let cancelled = false
    listCircles()
      .then(list => { if (!cancelled) setCircles(list) })
      .catch(err => console.error('[Feed] listCircles failed', err))
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  const bottomSheetStyle = {
    position: 'fixed', inset: 0, zIndex: 300,
    backgroundColor: 'rgba(15,15,30,0.5)', display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', overflow: 'hidden',
  }
  const sheetContentStyle = {
    width: 'calc(100% - 24px)', maxWidth: 500, boxSizing: 'border-box',
    backgroundColor: clr.white,
    borderRadius: '24px 24px 0 0',
    padding: '24px 20px calc(48px + env(safe-area-inset-bottom))',
    maxHeight: 'calc(100dvh - 16px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    animation: 'slideUp 0.25s ease',
  }

  const Handle = () => <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><div style={{ width: 32, height: 4, backgroundColor: clr.border, borderRadius: 2 }} /></div>
  const Header = ({ title }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: clr.textDark }}>{title}</h3>
      <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}><svg width="24" height="24" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
    </div>
  )

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 16, color: clr.textDark, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }
  const submitStyle = { width: '100%', padding: '16px 0', borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color: '#FFFFFF', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 20px rgba(91,95,239,0.3)', marginTop: 8 }

  const content = () => {
    if (show === 'circle') return (
      <form onSubmit={async e => {
        e.preventDefault();
        const name = e.target.elements.cName.value;
        const topic = e.target.elements.cTopic.value;
        const desc = e.target.elements.cDesc.value;

        const check1 = checkContent(name);
        if (!check1.ok) return onShowToast(check1.reason);
        const check2 = checkContent(topic);
        if (!check2.ok) return onShowToast(check2.reason);
        const check3 = checkContent(desc);
        if (!check3.ok) return onShowToast(check3.reason);

        if (hoopsEnabled && circleHoops) {
          for (const hoop of circleHoops) {
            if (hoop.prompt) {
              const c = checkContent(hoop.prompt);
              if (!c.ok) return onShowToast(c.reason);
            }
            if (hoop.options) {
              for (const opt of hoop.options) {
                const c = checkContent(opt);
                if (!c.ok) return onShowToast(c.reason);
              }
            }
          }
        }
        try {
          const created = await createCircle({
            name,
            emoji: selectedCircleEmoji,
            city: currentUser?.city || 'Austin, TX',
            type: circlePrivacy === 'private' ? 'private' : 'open',
            category: 'social',
            interestTag: topic,
            coverGradient: 'from-indigo-500 via-sky-500 to-emerald-400',
            description: desc,
            vibe: 'Looking for group!',
            rules: [],
            hoops: hoopsEnabled ? circleHoops.filter(h => h.type === 'written' || h.type === 'multiplechoice') : [],
          })
          await refreshCircles?.()

          if (coverFile) {
            try {
              const url = await uploadCircleCover({ circleId: created.id, file: coverFile })
              await updateCircle(created.id, { coverImageUrl: url })
            } catch (uploadErr) {
              console.error('[Feed.CreateModals] uploadCircleCover failed', uploadErr)
              onShowToast("Circle created. The cover image didn't upload — you can add it from the circle page.")
            }
          }

          onClose()
          navigate(`/circles/${created.id}`)
        } catch (err) {
          console.error('[Feed.CreateModals] createCircle failed', err)
          onShowToast('Could not create the circle. Please try again.')
        }
      }}>
        <Handle /><Header title="Create a Circle" />
        
        {/* Emoji Icon Picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Circle Icon
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, backgroundColor: clr.indigoLt,
              border: `1.5px solid ${clr.indigo}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 26, flexShrink: 0,
            }}>
              {selectedCircleEmoji}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {['✨', '⭕', '🔥', '🎨', '📸', '⚽', '🏃', '☕', '📚', '🎵', '🎮', '🍕', '🧗', '🚲', '🧘', '🎬', '🐶', '✈️', '💡', '🌱', '🏀', '🎤', '🎲', '❤️'].map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setSelectedCircleEmoji(e)}
                  style={{
                    width: 38, height: 38, borderRadius: 12, border: selectedCircleEmoji === e ? `2px solid ${clr.indigo}` : `1px solid ${clr.border}`,
                    backgroundColor: selectedCircleEmoji === e ? clr.indigoLt : clr.bg,
                    fontSize: 20, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <input required name="cName" placeholder="Circle Name" style={inputStyle} />
        <input required name="cTopic" placeholder="Interest / Topic (e.g. Photography)" style={inputStyle} />
        
        {/* Cover Image Picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Cover Image (Optional)
          </label>
          {coverPreview ? (
            <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: 16, overflow: 'hidden', border: `1px solid ${clr.border}` }}>
              <img src={coverPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                style={{
                  position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFFFFF', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '16px', borderRadius: 16, border: `2px dashed ${clr.border}`,
              backgroundColor: clr.bg, cursor: 'pointer', transition: 'all 0.15s ease',
            }}>
              <span style={{ fontSize: 22, marginBottom: 2 }}>📷</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: clr.indigo }}>Upload Cover Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setCoverFile(file)
                    setCoverPreview(URL.createObjectURL(file))
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <label style={{ flex: 1, boxSizing: 'border-box', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, border: circlePrivacy === 'open' ? `1.5px solid ${clr.indigo}` : `1.5px solid ${clr.border}`, background: circlePrivacy === 'open' ? clr.indigoLt : 'transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            <input type="radio" name="type" checked={circlePrivacy === 'open'} onChange={() => setCirclePrivacy('open')} style={{ accentColor: clr.indigo }} /> Open
          </label>
          <label style={{ flex: 1, boxSizing: 'border-box', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, border: circlePrivacy === 'private' ? `1.5px solid ${clr.indigo}` : `1.5px solid ${clr.border}`, background: circlePrivacy === 'private' ? clr.indigoLt : 'transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            <input type="radio" name="type" checked={circlePrivacy === 'private'} onChange={() => setCirclePrivacy('private')} style={{ accentColor: clr.indigo }} /> Private
          </label>
        </div>
        <textarea name="cDesc" placeholder="Short description..." rows={3} style={{ ...inputStyle, resize: 'none' }} />

        {/* Hoops toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: 12 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: clr.textDark }}>🏀 Require Entry Hoops</p>
            <p style={{ margin: 0, fontSize: 12, color: clr.textMid }}>Set questions applicants must answer</p>
          </div>
          <div onClick={() => { setHoopsEnabled(!hoopsEnabled); if (!hoopsEnabled && circleHoops.length === 0) setCircleHoops([]) }} style={{
            width: 50, height: 28, borderRadius: 999,
            backgroundColor: hoopsEnabled ? clr.indigo : clr.border,
            position: 'relative', cursor: 'pointer', transition: 'background-color 0.3s ease',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: hoopsEnabled ? 24 : 2,
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'left 0.3s ease',
            }} />
          </div>
        </div>
        {hoopsEnabled && (
          <div style={{ marginBottom: 16 }}>
            <HoopBuilder hoops={circleHoops} onChange={setCircleHoops} />
          </div>
        )}

        <button type="submit" style={submitStyle}>Create Circle →</button>
      </form>
    )
    if (show === 'event') return (
      <form onSubmit={async e => {
        e.preventDefault();
        const title = e.target.elements.eName.value;
        const check = checkContent(title);
        if (!check.ok) return onShowToast(check.reason);
        const date = e.target.elements.eDate.value;
        const time = e.target.elements.eTime.value;
        const cid = e.target.elements.eCircle.value;
        const effectiveEndDate = recurrenceRule !== 'none'
          ? (recurrenceEndDate || (date ? new Date(new Date(date).getTime() + 56 * 86400000).toISOString().slice(0, 10) : null))
          : null

        try {
          const createdEvent = await createEventAndRsvp({
            circleId: cid || null,
            title,
            date,
            time,
            location: eventLocation?.name || '',
            locationLat: eventLocation?.lat ?? null,
            locationLng: eventLocation?.lng ?? null,
            locationAddress: eventLocation?.address || '',
            notes: '',
            recurrenceRule,
            recurrenceEndDate: effectiveEndDate,
          });

          if (coverFile && createdEvent?.id) {
            try {
              const url = await uploadEventCover({ eventId: createdEvent.id, file: coverFile })
              await updateEvent({ eventId: createdEvent.id, coverImageUrl: url })
            } catch (err) {
              console.error('[Feed] event cover upload failed', err)
              onShowToast('Event created, but the cover image failed to upload')
            }
          }

          setEventLocation(null);
          setCoverFile(null);
          setCoverPreview(null);
          setRecurrenceRule('none');
          setRecurrenceEndDate('');
          onClose();
          onShowToast('Event created successfully!');
        } catch (err) {
          console.error('[Feed] create event failed', err);
          alert('Sorry — something went wrong creating your event.');
        }
      }}>
        <Handle /><Header title="Host an Event" />
        
        {/* Cover Photo Picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Cover Photo</label>
          <label style={{
            display: 'block', position: 'relative', width: '100%', aspectRatio: '16/9',
            borderRadius: 16, border: `1.5px dashed ${clr.border}`, backgroundColor: clr.bg,
            overflow: 'hidden', cursor: 'pointer', textAlign: 'center',
          }}>
            {coverPreview ? (
              <>
                <img src={coverPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF',
                  fontSize: 14, fontWeight: 700,
                }}>
                  📷 Change Cover Photo
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: clr.textMid }}>
                <span style={{ fontSize: 24, marginBottom: 4 }}>📷</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Add a cover photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  setCoverFile(file)
                  setCoverPreview(URL.createObjectURL(file))
                }
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <input required name="eName" placeholder="Event Name" style={inputStyle} />

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Date</label>
            <input required name="eDate" type="date" onClick={(e) => { try { e.target.showPicker() } catch (err) { } }} style={{
              ...inputStyle,
              marginBottom: 0,
              minWidth: 0,
              maxWidth: '100%',
              WebkitAppearance: 'none',
              appearance: 'none',
            }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Start Time</label>
          <TimePicker value={eventTime} onChange={setEventTime} />
          <input type="hidden" name="eTime" value={eventTime} />
        </div>

        {/* Repeats Select */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Repeats</label>
          <select value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)} style={inputStyle}>
            <option value="none">None</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {recurrenceRule !== 'none' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Repeat until</label>
            <input
              type="date"
              value={recurrenceEndDate}
              onChange={e => setRecurrenceEndDate(e.target.value)}
              onClick={(e) => { try { e.target.showPicker() } catch {} }}
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: clr.textMid, margin: '4px 0 0 0', fontWeight: 600 }}>
              Creates {(() => {
                const dateVal = document.querySelector('input[name="eDate"]')?.value
                if (!dateVal) return 1
                const iso = `${dateVal}T${eventTime}:00`
                const end = recurrenceEndDate || (new Date(new Date(dateVal).getTime() + 56 * 86400000).toISOString().slice(0, 10))
                return expandRecurrence({ startsAt: iso, rule: recurrenceRule, endDate: end, maxOccurrences: 26 }).length
              })()} events
            </p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Location</label>
          <LocationAutocomplete
            value={eventLocation}
            onChange={setEventLocation}
            biasNear={biasNear}
            clr={clr}
          />
        </div>
        <select name="eCircle" style={inputStyle}>
          <option value="">No specific circle (Community Event)</option>
          {joinedCircles.map(id => { const c = circles.find(x => x.id === id); return c ? <option key={id} value={id}>{c.name}</option> : null })}
        </select>
        <input type="number" placeholder="Max attendees (optional)" style={inputStyle} />
        <button type="submit" style={submitStyle}>Create Event →</button>
      </form>
    )
    if (show === 'lfg') return (
      <form onSubmit={e => { e.preventDefault(); setLfgLocation(null); onClose(); onShowToast('LFG posted!') }}>
        {/* Intentionally a stub per requirements; persistence out of scope */}
        <Handle /><Header title="Looking For Group" />
        <input required placeholder="What do you want to do? (Grab coffee, shoot hoops...)" style={inputStyle} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {["Right now", "In 1hr", "This evening", "Custom"].map(t => <span key={t} style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${clr.border}`, fontSize: 13, fontWeight: 600, color: clr.textMid }}>{t}</span>)}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Where</label>
          <LocationAutocomplete
            value={lfgLocation}
            onChange={setLfgLocation}
            biasNear={biasNear}
            clr={clr}
          />
        </div>
        <button type="submit" style={{ ...submitStyle, background: `linear-gradient(135deg, #F59E0B, #FCD34D)`, color: '#FFF', boxShadow: '0 6px 20px rgba(245,158,11,0.3)' }}>Post LFG →</button>
      </form>
    )
    if (show === 'coffee') {
      const results = coffeeSearch.trim() ? connections.filter(p => !blockedUserIds?.includes(p.id) && p.name.toLowerCase().includes(coffeeSearch.toLowerCase())).slice(0, 3) : []
      return (
        <form onSubmit={async e => {
          e.preventDefault(); if (!coffeeTarget) return
          try {
            const firstName = coffeeTarget.name.split(' ')[0]
            const when = coffeeDate
              ? new Date(`${coffeeDate}T${coffeeTime}:00`).toLocaleString([], {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit'
                })
              : ''
            const locTxt = coffeeLocation?.name
              ? `\n\n📍 ${coffeeLocation.name}${coffeeLocation.address ? '\n' + coffeeLocation.address.split(',').slice(0, 2).join(',') : ''}\n${buildMapsUrl(coffeeLocation)}`
              : ''
            let msg = `Hey ${firstName}! Want to grab coffee? ☕`
            if (when) {
              msg += `\n🗓️ ${when}`
            }
            if (coffeeLocation?.name) {
              msg += locTxt
            }
            if (coffeeNote.trim()) {
              msg += `\n\n${coffeeNote.trim()}`
            }
            const chatId = await startDM(coffeeTarget)
            await sendMessage(chatId, msg, null, 'coffee_invite', {
              date: coffeeDate,
              time: coffeeTime,
              whenFormatted: when,
              location: coffeeLocation?.name || '',
              locationLat: coffeeLocation?.lat ?? null,
              locationLng: coffeeLocation?.lng ?? null,
              locationAddress: coffeeLocation?.address || '',
              note: coffeeNote.trim(),
              status: 'pending',
              eventId: null,
              inviterId: currentUser?.id,
              inviterName: currentUser?.name || '',
              targetId: coffeeTarget.id,
              targetName: coffeeTarget.name || '',
            })
            setCoffeeLocation(null); setCoffeeTarget(null); setCoffeeSearch(''); setCoffeeDate(''); setCoffeeNote('');
            onClose(); onShowToast('Invite sent!')
          } catch (err) {
            console.error('[Feed.CreateModals] startDM failed', err)
          }
        }}>
          <Handle /><Header title="Coffee Chat Invite" />
          {!coffeeTarget ? (
            <div style={{ marginBottom: 16 }}>
              <input placeholder="Who do you want to meet?" value={coffeeSearch} onChange={e => setCoffeeSearch(e.target.value)} style={inputStyle} autoFocus />
              {coffeeSearch.trim() && connections.length === 0 && (
                <div style={{ padding: '12px 16px', fontSize: 13, color: clr.textMid }}>
                  You haven't connected with anyone yet. Connect with someone first, then invite them for coffee.
                </div>
              )}
              {coffeeSearch.trim() && connections.length > 0 && results.length === 0 && (
                <div style={{ padding: '12px 16px', fontSize: 13, color: clr.textMid }}>
                  No matching connections. Try a different name.
                </div>
              )}
              {results.length > 0 && <div style={{ padding: '8px 0', border: `1px solid ${clr.border}`, borderRadius: 16 }}>
                {results.map(p => (
                  <div key={p.id} onClick={() => setCoffeeTarget(p)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}>
                    <img src={avatarFor(p)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: clr.textDark }}>{p.name}</span>
                  </div>
                ))}
              </div>}
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, border: `1.5px solid ${clr.border}`, marginBottom: 16 }}>
                <img src={avatarFor(coffeeTarget)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: clr.textDark, flex: 1 }}>{coffeeTarget.name}</span>
                <button type="button" onClick={() => setCoffeeTarget(null)} style={{ background: 'none', border: 'none', fontSize: 13, color: clr.textLight, cursor: 'pointer' }}>Change</button>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Date</label>
                  <input required type="date" value={coffeeDate} onChange={e => setCoffeeDate(e.target.value)} onClick={(e) => { try { e.target.showPicker() } catch (err) { } }} style={{
                    ...inputStyle,
                    marginBottom: 0,
                    minWidth: 0,
                    maxWidth: '100%',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Time</label>
                <TimePicker value={coffeeTime} onChange={setCoffeeTime} />
                <input type="hidden" name="cTime" value={coffeeTime} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Where</label>
                <LocationAutocomplete
                  value={coffeeLocation}
                  onChange={setCoffeeLocation}
                  biasNear={biasNear}
                  clr={clr}
                />
              </div>
              <textarea placeholder="Add a short note... (optional)" rows={2} value={coffeeNote} onChange={e => setCoffeeNote(e.target.value)} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          )}
          <button type="submit" disabled={!coffeeTarget || !coffeeDate} style={{ ...submitStyle, opacity: (!coffeeTarget || !coffeeDate) ? 0.5 : 1 }}>Send Invite →</button>
        </form>
      )
    }
  }

  return <div style={bottomSheetStyle} onClick={onClose}><div style={sheetContentStyle} onClick={e => e.stopPropagation()}>{content()}</div></div>
}

/* ── Battery Helpers & Components ── */
function getBatteryConfig(points) {
  if (points >= 80) return {
    label: 'Fully Charged',
    sublabel: 'You\'re on fire socially 🔥',
    color: '#10B981',  // green
    glow: 'rgba(16,185,129,0.4)',
    segments: 4,
  }
  if (points >= 60) return {
    label: 'Charged Up',
    sublabel: 'Keep the momentum going',
    color: '#5B5FEF',  // indigo
    glow: 'rgba(91,95,239,0.4)',
    segments: 3,
  }
  if (points >= 35) return {
    label: 'Getting There',
    sublabel: 'A meetup would charge you up',
    color: '#F59E0B',  // amber
    glow: 'rgba(245,158,11,0.4)',
    segments: 2,
  }
  return {
    label: 'Running Low',
    sublabel: 'Time to get out there 👋',
    color: '#EF4444',  // red
    glow: 'rgba(239,68,68,0.4)',
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
        {[0, 1, 2, 3].map(i => (
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
  const { batteryPoints, currentUser } = useAppContext()
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const config = getBatteryConfig(batteryPoints)

  useEffect(() => {
    if (!showHistory || !currentUser?.id) return
    let cancelled = false
    setHistoryLoading(true)
    listBatteryHistory(currentUser.id, 3)
      .then(rows => { if (!cancelled) setHistory(rows) })
      .catch(err => console.error('[SocialBattery] history load failed', err))
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [showHistory, currentUser?.id, batteryPoints])

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        onClick={() => setShowHistory(h => !h)}
        style={{
          backgroundColor: clr.white,
          borderRadius: showHistory ? '24px 24px 0 0' : 24,
          padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, border-radius 0.2s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = showHistory ? 'translateY(0)' : 'translateY(-1px)'}
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
              }} />
            </div>
            <p style={{ fontSize: 11, color: clr.textMid, margin: '8px 0 0 0' }}>
              {batteryPoints < 35
                ? '💡 Join a circle or attend an event to charge up'
                : batteryPoints < 60
                  ? '💡 Send a message or join a circle to boost your battery'
                  : '✨ Great work — keep socializing!'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {showHistory && (
        <div style={{
          backgroundColor: clr.white,
          borderRadius: '0 0 24px 24px',
          marginTop: 0,
          padding: '16px 20px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          animation: 'slideDown 0.2s ease',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent Activity
          </p>

          {historyLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ height: 44, borderRadius: 14, backgroundColor: clr.bg, animation: 'pulse 1.4s ease-in-out infinite' }} />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
              No activity yet. Join a circle, RSVP to an event, or send a message to start moving the needle.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(h => {
                const positive = h.points >= 0
                const sign = positive ? '+' : '−'
                const absVal = Math.abs(h.points)
                const pillBg = positive ? '#DCFCE7' : '#FEE2E2'
                const pillFg = positive ? '#059669' : '#DC2626'
                return (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 14,
                    backgroundColor: clr.bg,
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 800,
                      color: pillFg, backgroundColor: pillBg,
                      padding: '4px 10px', borderRadius: 999, minWidth: 48, textAlign: 'center',
                    }}>
                      {sign}{absVal}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.reason}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: clr.textLight }}>
                        {relativeTime(h.createdAt)} · battery now {h.result}
                      </p>
                    </div>
                  </div>
                )
              })}
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
  const {
    currentUser, joinedCircles, joinCircle, meetups, rsvpEvent, cancelRsvp, isRsvpd, circleMembershipVersion,
    startDM, recentInviter, clearRecentInviter, skipIntentCapture, updateMyIntents, connections, blockedUserIds
  } = useAppContext()
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState(null) // null = closed, string = open

  const [people, setPeople] = useState([])
  const [circles, setCircles] = useState([])
  const [events, setEvents] = useState([])
  useEffect(() => {
    let cancelled = false
    listProfiles({ excludeUserId: currentUser?.id })
      .then(list => { if (!cancelled) setPeople(list) })
      .catch(err => console.error('[Feed] listProfiles failed', err))
    listCircles()
      .then(list => { if (!cancelled) setCircles(list) })
      .catch(err => console.error('[Feed] listCircles failed', err))
    listUpcomingEvents({ limit: 30 })
      .then(list => { if (!cancelled) setEvents(list) })
      .catch(err => console.error('[Feed] listUpcomingEvents failed', err))
    return () => { cancelled = true }
  }, [currentUser?.id, circleMembershipVersion])
  const [showCreateModal, setShowCreateModal] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    if (!showCreateModal) return

    const scrollY = window.scrollY
    const body = document.body
    const root = document.documentElement
    const prevBodyOverflow = body.style.overflow
    const prevBodyPosition = body.style.position
    const prevBodyTop = body.style.top
    const prevBodyWidth = body.style.width
    const prevRootOverflow = root.style.overflow

    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.overflow = prevBodyOverflow
      root.style.overflow = prevRootOverflow
      body.style.position = prevBodyPosition
      body.style.top = prevBodyTop
      body.style.width = prevBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [showCreateModal])

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

  const firstName = currentUser?.name?.split(' ')[0] ?? 'there'

  const completeness = useMemo(() => profileCompleteness(currentUser || {}), [currentUser])

  const upcomingMeetups = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return [...(meetups || [])]
      .filter(m => new Date(m.date) >= today)
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
      @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
      @keyframes stepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes celebrationPop { 0% { opacity: 0; transform: scale(0.95); } 60% { transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes shimmerSpin { to { transform: rotate(360deg); } }
      @keyframes sparkleTwinkle { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.92); } }
      @keyframes exampleFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const activeBlockedIds = blockedUserIds || []
    return {
      people: people.filter(p => !activeBlockedIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.interests?.some(i => i.toLowerCase().includes(q)) || p.bio?.toLowerCase().includes(q))),
      circles: circles.filter(c => c.name.toLowerCase().includes(q) || c.interestTag?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)),
      events: events.filter(e => e.title.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q)),
    }
  }, [searchQuery, people, circles, events, blockedUserIds])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const askAssistantRow = (
    <button
      type="button"
      onClick={() => { const q = searchQuery.trim(); if (q) { setAssistantPrompt(q); setSearchQuery('') } }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
        border: `1.5px solid ${clr.indigo}`,
        backgroundColor: clr.white, textAlign: 'left',
        fontFamily: 'inherit', marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>✦</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Ask about "{searchQuery}"
        </span>
        <span style={{ display: 'block', fontSize: 12, color: clr.textMid, marginTop: 2 }}>
          Get help finding or creating something
        </span>
      </span>
      <svg width="16" height="16" fill="none" stroke={clr.indigo} strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: clr.bg, fontFamily: "'DM Sans','Inter',sans-serif", paddingBottom: 110 }}>

      <div style={{ padding: '0 16px', margin: '0 auto' }}>
        {!completeness.isComplete && <ProfileCompletionCard completeness={completeness} />}
        {/* ── Greeting ── */}
        <div style={{ padding: '14px 0 14px' }}>
          <h1 style={{
            fontSize: 26, fontWeight: 800, color: clr.textDark,
            margin: 0, letterSpacing: '-0.02em',
            fontFamily: "'DM Serif Display','Georgia',serif",
            paddingLeft: 4,
          }}>
            {getGreeting()}, {firstName}
          </h1>
        </div>

        {/* ── Search Bar ── */}
        <div>
          <AssistantBar
            clr={clr}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search or ask anything..."
            onSubmit={(text) => { if (text) setAssistantPrompt(text) }}
          />
        </div>

        {/* ── View Controller ── */}
        {searchResults ? (
          <div style={{ animation: 'slideUp 0.15s ease' }}>
            {searchResults.people.length === 0 && searchResults.circles.length === 0 && searchResults.events.length === 0 ? (
              <div style={{ padding: '8px 0' }}>
                {askAssistantRow}
                <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: clr.textDark, margin: '0 0 6px 0' }}>
                    Nothing matched "{searchQuery}"
                  </p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    Try asking instead — the assistant can search more broadly or create something new.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {askAssistantRow}
                {searchResults.people.length > 0 && (
                  <section><SectionHeader title="People" /><HScrollRow>{searchResults.people.map(p => <PersonCard key={p.id} person={p} />)}</HScrollRow></section>
                )}
                {searchResults.circles.length > 0 && (
                  <section><SectionHeader title="Circles" /><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{searchResults.circles.map((c, idx) => <CircleCard key={c.id} circle={c} idx={idx} isJoined={joinedCircles.includes(c.id)} onJoin={() => joinCircle(c.id)} onClick={() => navigate(`/circles/${c.id}`)} />)}</div></section>
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
              <div style={{ height: 24, marginBottom: 14 }}></div>
              <CreateWheel onAction={(id) => {
                if (id === 'lfg' && currentUser?.privacy?.isPrivateProfile) {
                  showToast('LFG posts are restricted to public profiles.')
                } else {
                  setShowCreateModal(id)
                }
              }} />
            </section>

            <section>
              <div style={{ height: 24, marginBottom: 14 }}></div>
              <button type="button" onClick={() => setShowDiscovery(true)} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                style={{ width: '100%', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 60%, #A78BFA 100%)', padding: '24px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 28px rgba(91,95,239,0.3)', transition: 'transform 0.2s ease' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>Meet Someone New</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Swipe through people, circles & events</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {people.filter(p => !blockedUserIds?.includes(p.id)).slice(0, 3).map((p, i) => <img key={p.id} src={avatarFor(p)} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid rgba(255,255,255,0.6)', marginLeft: i === 0 ? 0 : -14, zIndex: 3 - i, position: 'relative' }} />)}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}><svg width="16" height="16" fill="none" stroke="#FFFFFF" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg></div>
                </div>
              </button>
            </section>

            <div style={{ marginTop: 28 }}>
              <SocialBattery />
            </div>

            {upcomingMeetups.length > 0 && (
              <section style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
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

      <CreateModals show={showCreateModal} onClose={() => setShowCreateModal(null)} onShowToast={showToast} people={people} connections={connections} refreshCircles={async () => {
        try {
          const list = await listCircles()
          setCircles(list)
        } catch (err) {
          console.error('[Feed] listCircles failed', err)
        }
      }} />
      {showDiscovery && <div style={{ position: 'fixed', inset: 0, zIndex: 200, animation: 'expandUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}><SwipeDiscovery onClose={() => setShowDiscovery(false)} /></div>}
      {toastMsg && <div style={{ position: 'fixed', bottom: 100, left: '50%', zIndex: 400, transform: 'translateX(-50%)', background: clr.textDark, color: '#FFF', padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 600, animation: 'fadeToast 2.5s ease forwards', whiteSpace: 'nowrap' }}>{toastMsg}</div>}

      {/* ── Assistant Modal ── */}
      {assistantPrompt !== null && (
        <AssistantModal
          initialPrompt={assistantPrompt}
          clr={clr}
          onClose={() => setAssistantPrompt(null)}
        />
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

      {/* Modals for Phase 2 */}
      {/* Onboarding Modal */}
      {(() => {
        if (!currentUser || onboardingDismissed) return null
        const needsCelebration = !!recentInviter
        const needsIntent = currentUser.intentCapturedAt == null && !window.localStorage.getItem(`ts_intent_${currentUser.id}`)
        if (!needsCelebration && !needsIntent) return null
        return (
          <OnboardingModal
            inviter={recentInviter || null}
            showIntent={needsIntent}
            onClose={() => setOnboardingDismissed(true)}
          />
        )
      })()}
    </div>
  )
}

