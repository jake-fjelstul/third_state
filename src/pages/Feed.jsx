import { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import ProfileCompletionCard from '../components/feed/ProfileCompletionCard.jsx'
import { profileCompleteness } from '../lib/profileCompleteness.jsx'
import { listUpcomingEvents, expandRecurrence, updateEvent, getEvent, DURATION_OPTIONS, DEFAULT_DURATION_MINUTES } from '../lib/events'
import { uploadEventCover, uploadCircleCover } from '../lib/storage'
import { listVisibleCircles, updateCircle, requiresApplication } from '../lib/circles'
import { listProfiles, searchProfiles } from '../lib/profiles'
import HoopBuilder from '../components/hoops/HoopBuilder.jsx'
import SwipeDiscovery from '../components/discovery/SwipeDiscovery.jsx'
import EventDetailModal from '../components/EventDetailModal.jsx'
import CreateWheel from '../components/CreateWheel.jsx'
import { CREATE_ACTION_DEFS } from '../lib/createActions.js'
import CircleIcon from '../components/ui/CircleIcon.jsx'
import { CIRCLE_ICONS, DEFAULT_CIRCLE_ICON, KEY_TO_EMOJI } from '../lib/circleIcons.js'
import { Calendar, Camera, Dribbble, X as XIcon, Zap, MapPin, Clock, Timer, Plus, Check, ChevronRight, Gamepad2, Users, Coffee, UserPlus, MessageCircle, Bell, UserRound, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import { matchActions } from '../lib/searchActions.js'
import SoloGameModal from '../components/games/SoloGameModal.jsx'
import { Avatar, Chip, SectionHeader as DsSectionHeader } from '../components/ui/ds.jsx'
import { publishMyStatus, consumeOpenStatus, OPEN_STATUS_EVENT } from '../lib/statusBus.js'
import { HOME_RESET_EVENT } from '../lib/homeBus.js'
import { checkinShareUrl, shareLink } from '../lib/share.js'
import TimePicker from '../components/TimePicker.jsx'
import { avatarFor } from '../lib/avatar'
import OnboardingModal from '../components/feed/OnboardingModal.jsx'
import OnboardingFlow from '../components/onboarding/OnboardingFlow.jsx'
import { readCache, writeCache, reviveEvents } from '../lib/localCache.js'
import { useRefreshOnTabReturn, useIsTabActive } from '../lib/tabActive.js'
import LocationAutocomplete from '../components/ui/LocationAutocomplete.jsx'
import { buildMapsUrl, searchVenues } from '../lib/geocoding.js'
import AssistantBar from '../components/feed/AssistantBar.jsx'
import AssistantModal from '../components/assistant/AssistantModal.jsx'
import { checkContent } from '../lib/contentFilter.js'
import {
  LFG_WINDOWS, resolveWindow, suggestionsForNow, createLfgPost,
  listMyLfgPosts, listJoinedLfgPosts, listActiveLfgPosts, getLfgJoiners,
  leaveLfgPost, cancelLfgPost, timeLeftLabel, getLfgJoinPreviews, joinLfgPost, startLabel,
  attachLfgPhoto, removeLfgPhoto, withLfgPhotoUrls,
} from '../lib/lfg'
import LfgRecipientPicker from '../components/lfg/LfgRecipientPicker.jsx'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight.js'
import CircleRow from '../components/ui/CircleRow.jsx'

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
  { bg: 'var(--indigoLt)', accent: 'var(--indigo)' },
  { bg: '#FEF3C7', accent: '#D97706' },
  { bg: '#D1FAE5', accent: '#059669' },
  { bg: '#FFE4E6', accent: '#E11D48' },
]

const EVENT_GRADIENTS = [
  'linear-gradient(135deg,#FF5A36,#FF8A65)',
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
      boxShadow: '0 0 0 1px var(--border)',
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
function CircleCard({ circle, isJoined, onJoin, onClick }) {
  return <CircleRow circle={circle} isJoined={isJoined} onJoin={onJoin} onClick={onClick} />
}

/* ── Event card ── */
function EventCard({ event, idx, isRsvpd, onViewDetails }) {
  const rsvpd = isRsvpd?.(event.id) ?? false
  return (
    <div onClick={() => onViewDetails?.(event)} style={{
      flexShrink: 0, width: 220,
      backgroundColor: clr.white,
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 0 0 1px var(--border)',
      cursor: 'pointer',
    }}>
      {/* Gradient header */}
      <div style={{
        height: 72,
        background: EVENT_GRADIENTS[idx % EVENT_GRADIENTS.length],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {event.emoji ? (
          <span style={{ fontSize: 28 }}>{event.emoji}</span>
        ) : (
          <Calendar size={28} color="#FFFFFF" />
        )}
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
            <span style={{ fontSize: 12, color: clr.textMid }}>{event.dateLabel || event.date} · {event.timeLabel || event.time}</span>
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
          background: rsvpd ? clr.indigoLt : `var(--indigo)`,
          color: rsvpd ? clr.indigo : 'var(--on-ink)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: rsvpd ? 'none' : 'none',
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
  const accents = ['var(--indigo)', '#0D9488', '#F59E0B', '#E11D48']
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
        boxShadow: '0 0 0 1px var(--border)',
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
        {meetup.timeLabel || meetup.time} · {meetup.location}
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
        background: `linear-gradient(135deg, ${action.surface[0]}, ${action.surface[1]})`,
        padding: '18px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s ease',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={action.accent} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          {action.paths.map((d, pi) => <path key={pi} d={d} />)}
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', margin: '0 0 3px 0' }}>{action.title}</p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>{action.desc}</p>
    </button>
  )
}

function CreateModals({ show, onClose, onShowToast, people, connections, refreshCircles, refreshLfg }) {
  const kbHeight = useKeyboardHeight()
  const navigate = useNavigate()
  const { joinedCircles, startDM, sendMessage, createEventAndRsvp, currentUser, discoverySwipes, createCircle, blockedUserIds, circleMembershipVersion } = useAppContext()
  const [coffeeSearch, setCoffeeSearch] = useState('')
  const [coffeeTarget, setCoffeeTarget] = useState(null)
  const [circlePrivacy, setCirclePrivacy] = useState('open')
  const [eventTime, setEventTime] = useState('18:00')
  const [eventDate, setEventDate] = useState('')
  const [eventDuration, setEventDuration] = useState(DEFAULT_DURATION_MINUTES)
  const [coffeeTime, setCoffeeTime] = useState('10:00')
  const [coffeeDate, setCoffeeDate] = useState('')
  const [coffeeNote, setCoffeeNote] = useState('')
  const [applicationsEnabled, setApplicationsEnabled] = useState(false)
  const [circleHoops, setCircleHoops] = useState([])
  const [circles, setCircles] = useState([])

  const [eventLocation, setEventLocation] = useState(null)
  const [coffeeLocation, setCoffeeLocation] = useState(null)
  const [lfgLocation, setLfgLocation] = useState(null)
  const [lfgActivity, setLfgActivity] = useState('')
  const [lfgWindow, setLfgWindow] = useState('now')
  const [lfgCustomStart, setLfgCustomStart] = useState('')
  const [lfgVisibility, setLfgVisibility] = useState('everyone')
  const [lfgNotify, setLfgNotify] = useState(true)
  const [lfgAudience, setLfgAudience] = useState('all')
  const [lfgInviteeIds, setLfgInviteeIds] = useState([])
  const [lfgVenues, setLfgVenues] = useState([])
  const [lfgVenuesLoading, setLfgVenuesLoading] = useState(false)
  const [lfgSubmitting, setLfgSubmitting] = useState(false)
  const [lfgError, setLfgError] = useState('')
  // Optional photo of what you're doing: { file, preview } or null.
  const [lfgPhoto, setLfgPhotoState] = useState(null)
  const setLfgPhoto = (file) => setLfgPhotoState(prev => {
    if (prev?.preview) URL.revokeObjectURL(prev.preview)
    return file ? { file, preview: URL.createObjectURL(file) } : null
  })

  const pickSuggestion = async (s) => {
    setLfgActivity(s.label)
    setLfgVenues([])
    if (!biasNear) return
    setLfgVenuesLoading(true)
    try {
      const list = await searchVenues(s.venueQuery, { near: biasNear })
      setLfgVenues((list || []).slice(0, 4))
    } catch { setLfgVenues([]) }
    finally { setLfgVenuesLoading(false) }
  }

  const handleLfgSubmit = async (e) => {
    e.preventDefault()
    setLfgError('')
    if (!lfgActivity.trim()) { setLfgError('What do you want to do?'); return }

    const targeting = lfgVisibility === 'friends' && lfgAudience === 'choose'
    if (targeting && lfgInviteeIds.length === 0) {
      setLfgError('Pick at least one person to notify, or choose All connections.')
      return
    }

    setLfgSubmitting(true)
    try {
      const { startsAt, expiresAt } = resolveWindow(lfgWindow, lfgCustomStart || null)
      const postId = await createLfgPost({
        activity: lfgActivity.trim(),
        startsAt, expiresAt,
        visibility: lfgVisibility,
        notifyConnections: targeting ? true : lfgNotify,
        inviteeIds: targeting ? lfgInviteeIds : null,
        place: lfgLocation,
      })
      // The post is live even if the photo fails; say so rather than undo it.
      let photoFailed = false
      if (lfgPhoto?.file && postId) {
        try {
          await attachLfgPhoto({ postId, userId: currentUser?.id, file: lfgPhoto.file })
        } catch (err) {
          console.error('[Feed] attachLfgPhoto failed', err)
          photoFailed = true
        }
      }
      setLfgPhoto(null)
      setLfgActivity(''); setLfgWindow('now'); setLfgCustomStart('')
      setLfgVisibility('everyone'); setLfgNotify(true)
      setLfgAudience('all'); setLfgInviteeIds([])
      setLfgVenues([]); setLfgLocation(null)
      onClose()
      onShowToast(photoFailed ? "Posted, but the photo didn't upload." : 'LFG posted!')
      await refreshLfg?.()
    } catch (err) {
      setLfgError(err?.message || 'Could not post. Please try again.')
    } finally {
      setLfgSubmitting(false)
    }
  }


  // Each form has its own cover photo; they used to share one, so a circle
  // cover could get uploaded as the next event's cover.
  const [covers, setCovers] = useState({ circle: null, event: null }) // { file, preview }
  const coverFile = covers[show]?.file ?? null
  const coverPreview = covers[show]?.preview ?? null
  const setCover = (kind, file) => setCovers(prev => {
    if (prev[kind]?.preview) URL.revokeObjectURL(prev[kind].preview)
    return { ...prev, [kind]: file ? { file, preview: URL.createObjectURL(file) } : null }
  })
  // One submit at a time: a double tap created two circles/events/invites.
  const [submitting, setSubmitting] = useState(false)
  const guarded = (fn) => async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try { await fn(e) } finally { setSubmitting(false) }
  }
  // Closing the sheet drops unsent cover photos.
  useEffect(() => {
    if (show) return
    setLfgPhotoState(prev => { if (prev?.preview) URL.revokeObjectURL(prev.preview); return null })
    setCovers(prev => {
      Object.values(prev).forEach(c => c?.preview && URL.revokeObjectURL(c.preview))
      return { circle: null, event: null }
    })
  }, [show])
  const [selectedCircleIcon, setSelectedCircleIcon] = useState(DEFAULT_CIRCLE_ICON)
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
    listVisibleCircles(currentUser?.id)
      .then(list => { if (!cancelled) setCircles(list) })
      .catch(err => console.error('[Feed] listCircles failed', err))
    return () => { cancelled = true }
  }, [circleMembershipVersion, currentUser?.id])

  if (!show) return null

  // The sheet rides above the keyboard so search results stay visible.
  const bottomSheetStyle = {
    position: 'fixed', inset: 0, zIndex: 300,
    backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', overflow: 'hidden',
    paddingBottom: kbHeight,
    transition: 'padding-bottom 0.25s ease',
  }
  const sheetContentStyle = {
    width: '100%', maxWidth: 560, boxSizing: 'border-box',
    backgroundColor: clr.white,
    borderRadius: '20px 20px 0 0',
    padding: kbHeight > 0 ? '8px 20px 16px' : '8px 20px calc(24px + env(safe-area-inset-bottom))',
    maxHeight: `calc(100dvh - env(safe-area-inset-top) - 28px - ${kbHeight}px)`,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    animation: 'tsSheetUp 0.34s cubic-bezier(0.32, 0.72, 0, 1) both',
  }

  // Sheet chrome (design v2): grabber, left title, round close button.
  const Handle = () => <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><div style={{ width: 36, height: 5, backgroundColor: 'var(--surface-3)', borderRadius: 3 }} /></div>
  const Header = ({ title }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: clr.textDark }}>{title}</h3>
      <button type="button" aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" fill="none" stroke={clr.textMid} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
    </div>
  )

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: 14, border: 'none', backgroundColor: 'var(--surface-2)', fontSize: 16, color: clr.textDark, outline: 'none', fontFamily: 'inherit', marginBottom: 14 }
  const submitStyle = { width: '100%', height: 50, borderRadius: 14, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 17, fontWeight: 600, cursor: 'pointer', marginTop: 8 }

  const content = () => {
    if (show === 'circle') return (
      <form onSubmit={guarded(async e => {
        const name = e.target.elements.cName.value;
        const topic = e.target.elements.cTopic.value;
        const desc = e.target.elements.cDesc.value;

        const check1 = checkContent(name);
        if (!check1.ok) return onShowToast(check1.reason);
        const check2 = checkContent(topic);
        if (!check2.ok) return onShowToast(check2.reason);
        const check3 = checkContent(desc);
        if (!check3.ok) return onShowToast(check3.reason);

        const wantsApplications = !!applicationsEnabled
        const validHoops = circleHoops.filter(h => h.type === 'written' || h.type === 'multiplechoice')

        if (wantsApplications && circleHoops) {
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
            icon: selectedCircleIcon,
            emoji: KEY_TO_EMOJI[selectedCircleIcon] || '👥',
            city: currentUser?.city || null,
            type: circlePrivacy === 'private' ? 'private' : 'open',
            category: 'social',
            interestTag: topic,
            coverGradient: 'from-indigo-500 via-sky-500 to-emerald-400',
            description: desc,
            vibe: 'Looking for group!',
            rules: [],
            applicationsEnabled: wantsApplications,
            hoops: wantsApplications ? validHoops : [],
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

          setCover('circle', null)
          onClose()
          navigate(`/circles/${created.id}`)
        } catch (err) {
          console.error('[Feed.CreateModals] createCircle failed', err)
          onShowToast('Could not create the circle. Please try again.')
        }
      })}>
        <Handle /><Header title="Create a Circle" />

        {/* Lucide Icon Picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Circle Icon
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, backgroundColor: clr.indigoLt,
              border: `1.5px solid ${clr.indigo}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <CircleIcon circle={{ icon: selectedCircleIcon }} size={24} color={clr.indigo} />
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {CIRCLE_ICONS.map(({ key, Comp, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  onClick={() => setSelectedCircleIcon(key)}
                  style={{
                    width: 40, height: 40, borderRadius: 12, border: selectedCircleIcon === key ? `2px solid ${clr.indigo}` : `1px solid ${clr.border}`,
                    backgroundColor: selectedCircleIcon === key ? clr.indigoLt : clr.bg,
                    cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Comp size={20} color={selectedCircleIcon === key ? clr.indigo : clr.textMid} strokeWidth={2} />
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
                onClick={() => setCover('circle', null)}
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
              <Camera size={22} color={clr.indigo} style={{ marginBottom: 2 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: clr.indigo }}>Upload Cover Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) setCover('circle', file)
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

        {/* Applications / Hoops toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: 12 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: clr.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dribbble size={16} color={clr.indigo} /> Require an application
            </p>
            <p style={{ margin: 0, fontSize: 12, color: clr.textMid }}>People apply and you approve them</p>
          </div>
          <div onClick={() => { setApplicationsEnabled(!applicationsEnabled); if (!applicationsEnabled && circleHoops.length === 0) setCircleHoops([]) }} style={{
            width: 50, height: 28, borderRadius: 999,
            backgroundColor: applicationsEnabled ? 'var(--good)' : 'var(--surface-3)',
            position: 'relative', cursor: 'pointer', transition: 'background-color 0.3s ease',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: applicationsEnabled ? 24 : 2,
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'left 0.3s ease',
            }} />
          </div>
        </div>
        {applicationsEnabled ? (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: clr.textMid }}>
              Optional — leave empty and applicants just confirm and send.
            </p>
            <HoopBuilder hoops={circleHoops} onChange={setCircleHoops} />
          </div>
        ) : circlePrivacy === 'private' ? (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: clr.textMid }}>
            Invite-only. People can only join with an invite link or QR code, and this circle won't appear in search or Discover.
          </p>
        ) : (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: clr.textMid }}>
            Anyone can join instantly.
          </p>
        )}

        <button type="submit" disabled={submitting} style={{ ...submitStyle, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Creating…' : 'Create Circle →'}</button>
      </form>
    )
    if (show === 'event') return (
      <form onSubmit={guarded(async e => {
        const title = e.target.elements.eName.value;
        const check = checkContent(title);
        if (!check.ok) return onShowToast(check.reason);
        const date = eventDate;
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
            durationMinutes: eventDuration,
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
          setCover('event', null);
          setEventDate('');
          setRecurrenceRule('none');
          setRecurrenceEndDate('');
          onClose();
          onShowToast('Event created successfully!');
        } catch (err) {
          console.error('[Feed] create event failed', err);
          onShowToast('Could not create the event. Please try again.');
        }
      })}>
        <Handle /><Header title="Host an Event" />

        {/* Cover Photo Picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Cover Photo</label>
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
                  fontSize: 14, fontWeight: 700, gap: 6,
                }}>
                  <Camera size={16} color="#FFFFFF" /> Change Cover Photo
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: clr.textMid }}>
                <Camera size={24} color={clr.indigo} style={{ marginBottom: 4 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Add a cover photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) setCover('event', file)
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <input required name="eName" placeholder="Event Name" style={inputStyle} />

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Date</label>
            <input required name="eDate" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} onClick={(e) => { try { e.target.showPicker() } catch (err) { } }} style={{
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
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Start Time</label>
          <TimePicker value={eventTime} onChange={setEventTime} />
          <input type="hidden" name="eTime" value={eventTime} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Duration</label>
          <select value={eventDuration} onChange={e => setEventDuration(Number(e.target.value))} style={inputStyle}>
            {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Repeats Select */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Repeats</label>
          <select value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)} style={inputStyle}>
            <option value="none">None</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {recurrenceRule !== 'none' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Repeat until</label>
            <input
              type="date"
              value={recurrenceEndDate}
              onChange={e => setRecurrenceEndDate(e.target.value)}
              onClick={(e) => { try { e.target.showPicker() } catch { } }}
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: clr.textMid, margin: '4px 0 0 0', fontWeight: 600 }}>
              Creates {(() => {
                const dateVal = eventDate
                if (!dateVal) return 1
                const iso = `${dateVal}T${eventTime}:00`
                const end = recurrenceEndDate || (new Date(new Date(dateVal).getTime() + 56 * 86400000).toISOString().slice(0, 10))
                return expandRecurrence({ startsAt: iso, rule: recurrenceRule, endDate: end, maxOccurrences: 26 }).length
              })()} events
            </p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Location</label>
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
        <button type="submit" disabled={submitting} style={{ ...submitStyle, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Creating…' : 'Create Event →'}</button>
      </form>
    )
    if (show === 'lfg') {
      // Sheet pieces (design v2): quiet labels, neutral chips, segmented controls.
      const label = { display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }
      const group = { marginBottom: 18 }
      const Segmented = ({ value, onChange, options }) => (
        <div role="radiogroup" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 12, background: 'var(--surface-2)' }}>
          {options.map(o => {
            const on = o.value === value
            return (
              <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} style={{
                flex: 1, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 15, fontWeight: 600,
                background: on ? 'var(--white)' : 'transparent',
                color: on ? clr.textDark : clr.textMid,
                boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{o.label}</button>
            )
          })}
        </div>
      )
      return (
      <form onSubmit={handleLfgSubmit}>
        <Handle /><Header title="I'm free" />

        <div style={group}>
          <input
            required
            value={lfgActivity}
            onChange={e => setLfgActivity(e.target.value)}
            placeholder="What are you up for?"
            aria-label="What are you up for?"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div className="noscrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
            {suggestionsForNow().map(sg => (
              <Chip key={sg.label} selected={lfgActivity === sg.label} onClick={() => pickSuggestion(sg)}>{sg.label}</Chip>
            ))}
          </div>
        </div>

        {lfgVenuesLoading && (
          <div style={{ ...group, fontSize: 14, color: clr.textMid }}>Finding places nearby…</div>
        )}
        {!lfgVenuesLoading && lfgVenues.length > 0 && (
          <div style={group}>
            <span style={label}>Nearby</span>
            <div style={{ borderRadius: 14, background: 'var(--surface-2)', overflow: 'hidden' }}>
              {lfgVenues.map((v, idx) => {
                const on = lfgLocation?.name === v.name
                return (
                  <button
                    key={`${v.name}-${idx}`}
                    type="button"
                    onClick={() => setLfgLocation({ name: v.name, address: v.address, lat: v.lat, lng: v.lng })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      borderTop: idx ? '0.5px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: clr.textDark }}>{v.name}</div>
                      {v.address && (
                        <div style={{ fontSize: 13, color: clr.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.address}</div>
                      )}
                    </div>
                    {on && <Check size={18} strokeWidth={2.6} color="var(--accent)" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={group}>
          <span style={label}>When</span>
          <div className="noscrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
            {LFG_WINDOWS.map(w => (
              <Chip key={w.id} selected={lfgWindow === w.id} onClick={() => setLfgWindow(w.id)}>{w.label}</Chip>
            ))}
          </div>
          {lfgWindow === 'custom' && (
            <input
              type="datetime-local"
              value={lfgCustomStart}
              onChange={e => setLfgCustomStart(e.target.value)}
              onClick={(e) => { try { e.target.showPicker() } catch { /* not supported */ } }}
              aria-label="Start time"
              style={{ ...inputStyle, margin: '10px 0 0' }}
            />
          )}
        </div>

        <div style={group}>
          <span style={label}>Where (optional)</span>
          <LocationAutocomplete
            value={lfgLocation}
            onChange={setLfgLocation}
            biasNear={biasNear}
            clr={clr}
          />
        </div>

        <div style={group}>
          <span style={label}>Photo (optional)</span>
          {lfgPhoto ? (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', height: 180, background: 'var(--surface-2)' }}>
              <img src={lfgPhoto.preview} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button type="button" aria-label="Remove photo" onClick={() => setLfgPhoto(null)} style={{
                position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'rgba(0,0,0,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}><XIcon size={16} /></button>
            </div>
          ) : (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderRadius: 14,
              background: 'var(--surface-2)', color: clr.textDark, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              <Camera size={18} color="var(--accent)" />
              Add a photo of what you're doing
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setLfgPhoto(f); e.target.value = '' }} />
            </label>
          )}
          <p style={{ margin: '6px 2px 0', fontSize: 12, color: clr.textLight, lineHeight: 1.4 }}>
            Only people who can see this post see it, and it's gone when the post ends.
          </p>
        </div>

        <div style={group}>
          <span style={label}>Who can see this</span>
          <Segmented
            value={lfgVisibility}
            onChange={(v) => { setLfgVisibility(v); if (v === 'everyone') setLfgAudience('all') }}
            options={[{ value: 'everyone', label: 'Everyone' }, { value: 'friends', label: 'Friends only' }]}
          />
        </div>

        {lfgVisibility === 'everyone' ? (
          <div style={{ ...group, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <span style={{ fontSize: 16, color: clr.textDark }}>Notify my connections</span>
            <button type="button" role="switch" aria-checked={lfgNotify} aria-label="Notify my connections" onClick={() => setLfgNotify(!lfgNotify)} style={{
              width: 50, height: 30, borderRadius: 999, border: 'none', flexShrink: 0, cursor: 'pointer', position: 'relative',
              backgroundColor: lfgNotify ? 'var(--good)' : 'var(--surface-3)', transition: 'background-color 0.2s ease',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: lfgNotify ? 23 : 3, width: 24, height: 24, borderRadius: '50%',
                backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s ease',
              }} />
            </button>
          </div>
        ) : (
          <div style={group}>
            <span style={label}>Who gets notified</span>
            <Segmented
              value={lfgAudience}
              onChange={setLfgAudience}
              options={[{ value: 'all', label: 'All connections' }, { value: 'choose', label: 'Choose people' }]}
            />
            {lfgAudience === 'choose' && (
              <div style={{ marginTop: 10 }}>
                <LfgRecipientPicker
                  connections={connections}
                  selectedIds={lfgInviteeIds}
                  onChange={setLfgInviteeIds}
                  clr={clr}
                />
              </div>
            )}
          </div>
        )}

        {lfgError && (
          <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, backgroundColor: 'var(--accent-soft)', color: 'var(--bad)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            {lfgError}
          </div>
        )}

        <button type="submit" disabled={lfgSubmitting} style={{ ...submitStyle, opacity: lfgSubmitting ? 0.6 : 1, cursor: lfgSubmitting ? 'default' : 'pointer' }}>
          {lfgSubmitting ? 'Posting…' : 'Post status'}
        </button>
      </form>
      )
    }
    if (show === 'coffee') {
      const results = coffeeSearch.trim() ? connections.filter(p => !blockedUserIds?.includes(p.id) && p.name.toLowerCase().includes(coffeeSearch.toLowerCase())).slice(0, 3) : []
      return (
        <form onSubmit={guarded(async e => {
          if (!coffeeTarget) return
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
            // The inviter's local wall-clock time, as an absolute instant.
            const startsAtDate = coffeeDate ? new Date(`${coffeeDate}T${coffeeTime || '10:00'}:00`) : null
            const startsAt = startsAtDate && !Number.isNaN(startsAtDate.getTime()) ? startsAtDate.toISOString() : null
            await sendMessage(chatId, msg, null, 'coffee_invite', {
              date: coffeeDate,
              time: coffeeTime,
              startsAt,
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
            console.error('[Feed.CreateModals] coffee invite failed', err)
            onShowToast("Couldn't send the invite. Please try again.")
          }
        })}>
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Date</label>
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Time</label>
                <TimePicker value={coffeeTime} onChange={setCoffeeTime} />
                <input type="hidden" name="cTime" value={coffeeTime} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: clr.textMid, marginBottom: 8 }}>Where</label>
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
          <button type="submit" disabled={!coffeeTarget || !coffeeDate || submitting} style={{ ...submitStyle, opacity: (!coffeeTarget || !coffeeDate || submitting) ? 0.5 : 1 }}>{submitting ? 'Sending…' : 'Send Invite →'}</button>
        </form>
      )
    }
  }

  return <div style={bottomSheetStyle} onClick={onClose}><div style={sheetContentStyle} onClick={e => e.stopPropagation()}>{content()}</div></div>
}

/* ── Battery Helpers & Components ── */
/* ── Search results (design v2): one list, grouped, with direct actions ── */
const ACTION_ICONS = { game: Gamepad2, circle: Users, event: Calendar, coffee: Coffee, status: Zap, people: UserPlus, chat: MessageCircle, photo: Camera, bell: Bell, user: UserRound, settings: SettingsIcon }

function SearchResults({ query, results, actions, joinedCircles, onJoinCircle, onOpenPerson, onOpenCircle, onOpenEvent, onAction, onAsk }) {
  const groupLabel = { margin: '18px 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--textMid)' }
  const row = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', minHeight: 56,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--textDark)',
  }
  const title = { fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const sub = { fontSize: 14, color: 'var(--textMid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const iconTile = (Icon) => (
    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} strokeWidth={1.9} />
    </div>
  )
  const nothing = results.people.length === 0 && results.circles.length === 0 && results.events.length === 0 && actions.length === 0
  return (
    <div style={{ animation: 'tsTabIn 0.2s ease-out', paddingBottom: 24 }}>
      {actions.length > 0 && (
        <section>
          <p style={groupLabel}>Actions</p>
          {actions.map(a => (
            <button key={a.id} type="button" style={row} onClick={() => onAction(a)}>
              {iconTile(ACTION_ICONS[a.icon] || Zap)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={title}>{a.label}</div>
                {a.hint && <div style={sub}>{a.hint}</div>}
              </div>
              <ChevronRight size={18} color="var(--textLight)" />
            </button>
          ))}
        </section>
      )}

      {results.people.length > 0 && (
        <section>
          <p style={groupLabel}>People</p>
          {results.people.slice(0, 8).map(p => (
            <button key={p.id} type="button" style={row} onClick={() => onOpenPerson(p)}>
              <Avatar person={p} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={title}>{p.name}</div>
                <div style={sub}>{p.bio || (p.interests || []).slice(0, 3).join(' · ') || p.city || ''}</div>
              </div>
              <ChevronRight size={18} color="var(--textLight)" />
            </button>
          ))}
        </section>
      )}

      {results.circles.length > 0 && (
        <section>
          <p style={groupLabel}>Circles</p>
          {results.circles.slice(0, 8).map(c => (
            <CircleRow key={c.id} circle={c} isJoined={joinedCircles.includes(c.id)} onJoin={() => onJoinCircle(c.id)} onClick={() => onOpenCircle(c)} />
          ))}
        </section>
      )}

      {results.events.length > 0 && (
        <section>
          <p style={groupLabel}>Events</p>
          {results.events.slice(0, 8).map(e => (
            <button key={e.id} type="button" style={row} onClick={() => onOpenEvent(e)}>
              <DateBlock d={e.dateObj} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={title}>{e.title}</div>
                <div style={sub}>{[e.timeLabel, e.location || e.circleName].filter(Boolean).join(' · ')}</div>
              </div>
              <ChevronRight size={18} color="var(--textLight)" />
            </button>
          ))}
        </section>
      )}

      {nothing && (
        <p style={{ margin: '28px 0 8px', textAlign: 'center', fontSize: 15, color: 'var(--textMid)' }}>
          Nothing matched “{query.trim()}”.
        </p>
      )}

      <section>
        <p style={groupLabel}>More</p>
        <button type="button" style={row} onClick={onAsk}>
          {iconTile(Sparkles)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={title}>Ask the assistant</div>
            <div style={sub}>“{query.trim()}”</div>
          </div>
          <ChevronRight size={18} color="var(--textLight)" />
        </button>
      </section>
    </div>
  )
}

/* ── Search, before you type: discovery lives here ── */
function SearchDiscover({ people, circles, onJoinCircle, onDiscover, onOpenPerson, onOpenCircle }) {
  const groupLabel = { margin: '18px 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--textMid)' }
  const row = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', minHeight: 56,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--textDark)',
  }
  const title = { fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const sub = { fontSize: 14, color: 'var(--textMid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  return (
    <div style={{ animation: 'tsTabIn 0.2s ease-out', paddingBottom: 24 }}>
      <button type="button" onClick={onDiscover} style={{
        ...row, marginTop: 8, padding: '14px 16px', borderRadius: 'var(--r-lg)', background: 'var(--accent-soft)',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <UserPlus size={20} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={title}>Meet someone new</div>
          <div style={sub}>Swipe through people, circles and events</div>
        </div>
        <ChevronRight size={18} color="var(--textMid)" />
      </button>

      {people.length > 0 && (
        <section>
          <p style={groupLabel}>People you might like</p>
          {people.map(p => (
            <button key={p.id} type="button" style={row} onClick={() => onOpenPerson(p)}>
              <Avatar person={p} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={title}>{p.name}</div>
                <div style={sub}>{(p.interests || []).slice(0, 3).join(' · ') || p.bio || p.city || ''}</div>
              </div>
              <ChevronRight size={18} color="var(--textLight)" />
            </button>
          ))}
        </section>
      )}

      {circles.length > 0 && (
        <section>
          <p style={groupLabel}>Circles to join</p>
          {circles.map(c => (
            <CircleRow key={c.id} circle={c} isJoined={false} onJoin={() => onJoinCircle(c.id)} onClick={() => onOpenCircle(c)} />
          ))}
        </section>
      )}
    </div>
  )
}

/* ── Home sections (design v2) ── */

function DateBlock({ d }) {
  return (
    <div style={{
      width: 46, height: 50, borderRadius: 12, background: 'var(--surface-2)', flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {d ? d.toLocaleDateString([], { month: 'short' }) : ''}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>{d ? d.getDate() : ''}</div>
    </div>
  )
}

// A post with a photo shows the photo in the ring, with the person's avatar
// as a small badge so you can still tell who it is.
function FreeNowBubble({ post, person, src, name }) {
  if (!post?.photoUrl) return <Avatar person={person} src={src} name={name} size={56} ring />
  return (
    <div style={{ position: 'relative', width: 66, height: 66 }}>
      <Avatar src={post.photoUrl} name={post.activity} size={56} ring />
      <div style={{ position: 'absolute', right: -2, bottom: -2, borderRadius: '50%', padding: 2, background: 'var(--bg)' }}>
        <Avatar person={person} src={src} name={name} size={22} />
      </div>
    </div>
  )
}

function FreeNowRow({ me, mine, others, onOpen }) {
  const myPost = mine[0] || null
  const item = (key, avatar, label, sub, onClick) => (
    <button key={key} type="button" onClick={onClick} style={{
      width: 72, flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      fontFamily: 'inherit', color: 'var(--textDark)', textAlign: 'center',
    }}>
      <div style={{ width: 66, height: 66, margin: '0 auto' }}>{avatar}</div>
      <div style={{ fontSize: 12, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--textLight)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
    </button>
  )
  return (
    <section data-tour="freenow" style={{ margin: '0 -16px', flexShrink: 0 }}>
      <DsSectionHeader title="Free now" style={{ margin: '8px 0 10px' }} />
      <div className="noscrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 4px' }}>
        {myPost && item('me',
          <FreeNowBubble post={myPost} person={me} />,
          'You',
          `${myPost.activity} · ${timeLeftLabel(myPost.expiresAt)}`,
          () => onOpen({ ...myPost, mine: true }))}
        {others.map(p => item(p.id,
          <FreeNowBubble post={p} src={p.authorAvatar} name={p.authorName} />,
          (p.authorName || '').split(' ')[0] || 'Someone',
          `${p.activity} · ${timeLeftLabel(p.expiresAt)}`,
          () => onOpen({ ...p, mine: false }),
        ))}
      </div>
    </section>
  )
}

function UpNextHero({ meetup, isRsvpd, onOpen }) {
  const cover = meetup.coverImageUrl
  const going = isRsvpd?.(meetup.id)
  const when = meetup.dateObj
    ? `${meetup.dateObj.toLocaleDateString([], { weekday: 'short' })} · ${meetup.timeLabel}`.toUpperCase()
    : ''
  return (
    <button type="button" onClick={() => onOpen(meetup)} style={{
      width: '100%', padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden',
      background: 'var(--white)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--textDark)',
      marginBottom: 4,
    }}>
      <div style={{
        height: 136, position: 'relative',
        background: cover ? `center/cover no-repeat url("${cover}")` : 'var(--surface-3)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6))' }} />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, letterSpacing: '0.03em' }}>{when}</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meetup.title}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
        <span style={{ fontSize: 14, color: 'var(--textMid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meetup.location || meetup.circleName || ' '}
        </span>
        {going && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--good)', flexShrink: 0 }}><Check size={16} strokeWidth={2.6} /> Going</span>}
      </div>
    </button>
  )
}

/* ── Main Feed ── */
export default function Feed() {
  const navigate = useNavigate()
  const [feedSearchParams, setFeedSearchParams] = useSearchParams()

  useEffect(() => {
    if (feedSearchParams.get('discover') === '1') {
      setShowDiscovery(true)
      feedSearchParams.delete('discover')
      setFeedSearchParams(feedSearchParams, { replace: true })
    }
  }, [feedSearchParams, setFeedSearchParams])

  // Shared links land here signed in: /e/:id -> ?event=, /s/:id -> ?checkin=.
  useEffect(() => {
    const eventId = feedSearchParams.get('event')
    const checkinId = feedSearchParams.get('checkin')
    if (!eventId && !checkinId) return
    feedSearchParams.delete('event')
    feedSearchParams.delete('checkin')
    setFeedSearchParams(feedSearchParams, { replace: true })
    if (eventId) {
      getEvent(eventId)
        .then(ev => { if (ev) setSelectedEvent(ev); else showToast("That event is private or was removed.") })
        .catch(() => showToast("Couldn't open that event."))
    } else {
      listActiveLfgPosts()
        .then(list => {
          const post = list.find(p => p.id === checkinId)
          if (!post) { showToast('That one already wrapped up.'); return }
          openLfgSheet({ ...post, mine: post.userId === currentUser?.id })
        })
        .catch(() => showToast("Couldn't open that."))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the link params arrive
  }, [feedSearchParams])

  const {
    currentUser, joinedCircles, joinCircle, meetups, rsvpEvent, cancelRsvp, isRsvpd, circleMembershipVersion,
    startDM, recentInviter, clearRecentInviter, skipIntentCapture, updateMyIntents, connections, blockedUserIds
  } = useAppContext()
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState(null) // null = closed, string = open
  const [searchOpen, setSearchOpen] = useState(false) // field tapped: show suggestions until Cancel
  const [soloGame, setSoloGame] = useState(null) // game type opened from a search action

  const [myLfg, setMyLfg] = useState([])
  const [activeLfg, setActiveLfg] = useState([])
  const [joinedLfg, setJoinedLfg] = useState([])
  const [lfgPreviews, setLfgPreviews] = useState({})
  const [lfgSheetPost, setLfgSheetPost] = useState(null)
  const [lfgPhotoBusy, setLfgPhotoBusy] = useState(false)
  const [lfgJoiners, setLfgJoiners] = useState([])
  const [lfgJoinersLoading, setLfgJoinersLoading] = useState(false)
  const [lfgJoining, setLfgJoining] = useState(false)

  const refreshLfg = useCallback(async () => {
    if (!currentUser?.id) return
    try {
      const [mine, joined, active] = await Promise.all([
        listMyLfgPosts(currentUser.id),
        listJoinedLfgPosts(currentUser.id),
        listActiveLfgPosts().catch(() => []),
      ])
      setMyLfg(mine)
      setJoinedLfg(joined)
      setActiveLfg(active)
      const ids = [...mine, ...joined].map(p => p.id)
      setLfgPreviews(await getLfgJoinPreviews(ids))
    } catch (err) {
      console.error('[Feed] lfg load failed', err)
    }
  }, [currentUser?.id])

  useEffect(() => { refreshLfg() }, [refreshLfg])

  // Top-bar "+" button: publish my live status, and open the right sheet on request.
  useEffect(() => { publishMyStatus(myLfg[0] || null) }, [myLfg])
  const openStatusRef = useRef(null)
  useEffect(() => {
    const handle = () => {
      if (!consumeOpenStatus()) return
      openStatusRef.current?.()
    }
    window.addEventListener(OPEN_STATUS_EVENT, handle)
    handle() // a request made from another tab, just before we became visible
    return () => window.removeEventListener(OPEN_STATUS_EVENT, handle)
  }, [])

  // Logo / Home tab: back to the plain Home screen (J4).
  useEffect(() => {
    const reset = () => {
      setSearchQuery('')
      setSearchOpen(false)
      setShowCreateModal(null)
      setLfgSheetPost(null)
      setAssistantPrompt(null)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      window.scrollTo({ top: 0 })
    }
    window.addEventListener(HOME_RESET_EVENT, reset)
    return () => window.removeEventListener(HOME_RESET_EVENT, reset)
  }, [])

  const openLfgSheet = async (post) => {
    setLfgSheetPost(post)
    setLfgJoiners([])
    setLfgJoinersLoading(true)
    try {
      setLfgJoiners(await getLfgJoiners(post.id))
    } catch (err) {
      console.error('[Feed] joiners load failed', err)
    } finally {
      setLfgJoinersLoading(false)
    }
  }

  // Cached lists render instantly; the fetches refresh them (issue 5).
  const [people, setPeople] = useState(() => readCache('feed.people') || [])
  const [circles, setCircles] = useState(() => readCache('feed.circles') || [])
  const [events, setEvents] = useState(() => readCache('feed.events', { revive: reviveEvents }) || [])
  const [feedReloadKey, setFeedReloadKey] = useState(0)
  useRefreshOnTabReturn(() => { setFeedReloadKey(k => k + 1); refreshLfg() })

  useEffect(() => {
    let cancelled = false
    listProfiles({ excludeUserId: currentUser?.id })
      .then(list => { if (!cancelled) { setPeople(list); writeCache('feed.people', list) } })
      .catch(err => console.error('[Feed] listProfiles failed', err))
    listVisibleCircles(currentUser?.id)
      .then(list => { if (!cancelled) { setCircles(list); writeCache('feed.circles', list) } })
      .catch(err => console.error('[Feed] listCircles failed', err))
    listUpcomingEvents({ limit: 30 })
      .then(list => { if (!cancelled) { setEvents(list); writeCache('feed.events', list) } })
      .catch(err => console.error('[Feed] listUpcomingEvents failed', err))
    return () => { cancelled = true }
  }, [currentUser?.id, circleMembershipVersion, feedReloadKey])
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
      .filter(m => m.dateObj && m.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj)
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

  // Everyone else who is free right now: posts I joined first, one ring per person.
  const freeNowOthers = useMemo(() => {
    const seen = new Set()
    return [...joinedLfg, ...activeLfg].filter(p => {
      if (!p.userId || p.userId === currentUser?.id || blockedUserIds?.includes(p.userId)) return false
      if (seen.has(p.userId)) return false
      seen.add(p.userId)
      return true
    })
  }, [joinedLfg, activeLfg, currentUser?.id, blockedUserIds])

  // The "+" in the top bar: my live status if I have one, else the create sheet.
  useEffect(() => {
    openStatusRef.current = () => {
      if (myLfg[0]) { openLfgSheet({ ...myLfg[0], mine: true }); return }
      if (currentUser?.privacy?.isPrivateProfile) showToast('Free now is for public profiles.')
      else setShowCreateModal('lfg')
    }
  })

  // First screen = search + Free now + wheel, nothing else. The wheel block is
  // as tall as the space between where it starts and the tab bar.
  const firstScreenRef = useRef(null)
  const [firstScreenTop, setFirstScreenTop] = useState(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = firstScreenRef.current
      if (!el || el.offsetParent === null) return // hidden tab
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY)
      setFirstScreenTop(prev => (prev === top ? prev : top))
    }
    measure()
    window.addEventListener('resize', measure)
    // Things above the wheel (the profile card, Free now) can appear or go
    // away without Home re-rendering, e.g. the card hides itself. Watch the
    // page column so the wheel re-sizes whenever its starting point moves.
    const parent = firstScreenRef.current?.parentElement
    const ro = typeof ResizeObserver !== 'undefined' && parent ? new ResizeObserver(measure) : null
    if (ro) {
      ro.observe(parent)
      Array.from(parent.children).forEach(child => { if (child !== firstScreenRef.current) ro.observe(child) })
    }
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  })

  // Home (not searching, nothing below the wheel) is one fixed screen: no
  // page scroll, no bounce.
  const tabActive = useIsTabActive()
  // With upcoming meetups, "Up next" sits below the wheel and Home scrolls to it.
  const homeLocked = !searchOpen && !searchQuery.trim() && upcomingMeetups.length === 0
  useEffect(() => {
    if (!tabActive || !homeLocked) return
    const root = document.documentElement
    const prev = root.style.overflow
    window.scrollTo(0, 0)
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = prev }
  }, [tabActive, homeLocked])

  // People search runs on the server so it isn't limited to who's loaded (M3).
  const [serverPeople, setServerPeople] = useState([])
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) { setServerPeople([]); return }
    let cancelled = false
    const t = setTimeout(() => {
      searchProfiles({ query: q, excludeUserId: currentUser?.id, limit: 30 })
        .then(rows => { if (!cancelled) setServerPeople(rows) })
        .catch(err => console.error('[Feed] people search failed', err))
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [searchQuery, currentUser?.id])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const activeBlockedIds = blockedUserIds || []
    const local = people.filter(p => !activeBlockedIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.interests?.some(i => i.toLowerCase().includes(q)) || p.bio?.toLowerCase().includes(q)))
    const seen = new Set(local.map(p => p.id))
    return {
      people: [...local, ...serverPeople.filter(p => !seen.has(p.id) && !activeBlockedIds.includes(p.id))],
      circles: circles.filter(c => c.name.toLowerCase().includes(q) || c.interestTag?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)),
      events: events.filter(e => e.title.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q)),
    }
  }, [searchQuery, people, serverPeople, circles, events, blockedUserIds])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div style={{ minHeight: homeLocked ? 0 : '100vh', backgroundColor: clr.bg, fontFamily: 'inherit', paddingBottom: homeLocked ? 0 : 110 }}>

      <div style={{ padding: '0 16px', margin: '0 auto' }}>
        {!completeness.isComplete && <ProfileCompletionCard completeness={completeness} />}

        {/* ── Search Bar ── */}
        <div>
          <AssistantBar
            clr={clr}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search people, circles, events"
            onSubmit={() => {}}
            active={searchOpen || !!searchQuery}
            onFocus={() => setSearchOpen(true)}
            onCancel={() => { setSearchQuery(''); setSearchOpen(false) }}
          />
        </div>

        {/* ── View Controller ── */}
        {searchResults ? (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            actions={matchActions(searchQuery)}
            joinedCircles={joinedCircles}
            onJoinCircle={joinCircle}
            onOpenPerson={(p) => navigate(`/user/${p.id}`)}
            onOpenCircle={(c) => navigate(`/circles/${c.id}`)}
            onOpenEvent={openEventDetail}
            onAction={(action) => {
              setSearchQuery('')
              action.run({
                navigate,
                openCreate: (kind) => {
                  if (kind === 'lfg' && currentUser?.privacy?.isPrivateProfile) showToast('LFG posts are restricted to public profiles.')
                  else if (kind === 'lfg') openStatusRef.current?.()
                  else setShowCreateModal(kind)
                },
                openSolo: (gameType) => setSoloGame(gameType),
                openDiscovery: () => setShowDiscovery(true),
              })
            }}
            onAsk={() => { const q = searchQuery.trim(); if (q) { setAssistantPrompt(q); setSearchQuery('') } }}
          />
        ) : searchOpen ? (
          <SearchDiscover
            people={people.filter(p => !blockedUserIds?.includes(p.id) && p.id !== currentUser?.id && !connections?.some(c => c.id === p.id)).slice(0, 4)}
            circles={circles.filter(c => !joinedCircles.includes(c.id)).slice(0, 3)}
            onJoinCircle={joinCircle}
            onDiscover={() => setShowDiscovery(true)}
            onOpenPerson={(p) => navigate(`/user/${p.id}`)}
            onOpenCircle={(c) => navigate(`/circles/${c.id}`)}
          />
        ) : (
          <>
            {/* First screen: search (above), Free now when anyone is free, and
                the create wheel sized to whatever height is left. Up next,
                when there is one, starts below the fold. */}
            <div ref={firstScreenRef} style={{
              height: firstScreenTop == null
                ? 'calc(100dvh - 200px)'
                : `calc(100dvh - ${firstScreenTop}px - 80px - env(safe-area-inset-bottom))`,
              minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              {(myLfg.length > 0 || freeNowOthers.length > 0) && (
                <FreeNowRow
                  me={currentUser}
                  mine={myLfg}
                  others={freeNowOthers}
                  onOpen={openLfgSheet}
                />
              )}
              <div style={{
                flex: 1, minHeight: 0, containerType: 'size', padding: '12px 0 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 'min(100cqw, 100cqh, 380px)' }}>
                  <CreateWheel onAction={(id) => {
                    if (id === 'lfg' && currentUser?.privacy?.isPrivateProfile) {
                      showToast('LFG posts are restricted to public profiles.')
                    } else {
                      setShowCreateModal(id)
                    }
                  }} />
                </div>
              </div>
            </div>

            {upcomingMeetups.length > 0 && (
              <section>
                <DsSectionHeader title="Up next" action="Schedule" onAction={() => navigate('/schedule')} style={{ padding: '0 4px' }} />
                <UpNextHero meetup={upcomingMeetups[0]} isRsvpd={isRsvpd} onOpen={openEventDetail} />
                {upcomingMeetups.slice(1).map(m => (
                  <button key={m.id} type="button" onClick={() => openEventDetail(m)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px',
                    background: 'none', border: 'none', borderTop: '0.5px solid var(--border)', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', color: 'var(--textDark)',
                  }}>
                    <DateBlock d={m.dateObj} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                      <div style={{ fontSize: 14, color: 'var(--textMid)' }}>{m.timeLabel}{m.location ? ` · ${m.location}` : ''}</div>
                    </div>
                    <ChevronRight size={18} color="var(--textLight)" />
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <CreateModals show={showCreateModal} onClose={() => setShowCreateModal(null)} onShowToast={showToast} refreshLfg={refreshLfg} people={people} connections={connections} refreshCircles={async () => {
        try {
          const list = await listVisibleCircles(currentUser?.id)
          setCircles(list)
        } catch (err) {
          console.error('[Feed] listCircles failed', err)
        }
      }} />
      {showDiscovery && <div style={{ position: 'fixed', inset: 0, zIndex: 200, animation: 'expandUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}><SwipeDiscovery onClose={() => setShowDiscovery(false)} /></div>}
      {toastMsg && <div style={{ position: 'fixed', bottom: 100, left: '50%', zIndex: 400, transform: 'translateX(-50%)', background: 'var(--toast-bg)', color: 'var(--toast-text)', padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 600, animation: 'fadeToast 2.5s ease forwards', whiteSpace: 'nowrap' }}>{toastMsg}</div>}

      {/* ── Assistant Modal ── */}
      {soloGame && <SoloGameModal gameType={soloGame} onClose={() => setSoloGame(null)} />}
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

      {/* ── LFG Joiner / Details Sheet ── */}
      {lfgSheetPost && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            backgroundColor: 'rgba(15,15,30,0.5)', display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', overflow: 'hidden',
          }}
          onClick={() => setLfgSheetPost(null)}
        >
          <div
            style={{
              width: 'calc(100% - 24px)', maxWidth: 500, boxSizing: 'border-box',
              backgroundColor: clr.white,
              borderRadius: '24px 24px 0 0',
              padding: '24px 20px calc(48px + env(safe-area-inset-bottom))',
              maxHeight: 'var(--sheet-max)',
              overflowY: 'auto',
              animation: 'tsSheetUp 0.34s cubic-bezier(0.32, 0.72, 0, 1) both',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 32, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
            </div>

            {lfgSheetPost.photoUrl && (
              <img src={lfgSheetPost.photoUrl} alt={`${lfgSheetPost.activity} photo`} style={{
                display: 'block', width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 16,
                marginBottom: 16, background: 'var(--surface-2)',
              }} />
            )}

            {/* Header: Activity & Countdown */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 800, color: clr.textDark, lineHeight: 1.3 }}>
                  {lfgSheetPost.activity}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {lfgSheetPost.placeName && (
                    <div style={{ fontSize: 13, color: clr.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={14} color={clr.textMid} /> {lfgSheetPost.placeName} {lfgSheetPost.placeAddress ? `(${lfgSheetPost.placeAddress})` : ''}
                    </div>
                  )}
                  {lfgSheetPost.startsAt && (
                    <div style={{ fontSize: 13, color: clr.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color={clr.textMid} /> Starts {startLabel(lfgSheetPost.startsAt)}
                    </div>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 800, color: '#B45309',
                backgroundColor: 'rgba(245,158,11,0.15)',
                padding: '6px 12px', borderRadius: 999, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Timer size={12} color="#B45309" /> {timeLeftLabel(lfgSheetPost.expiresAt)}
              </span>
            </div>

            {/* Joiners section */}
            <div style={{ marginBottom: 24, paddingTop: 16, borderTop: `1px solid ${clr.border}` }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: clr.textDark, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                {lfgSheetPost.mine || !joinedLfg.some(p => p.id === lfgSheetPost.id) ? "Who's in" : "You're in"}
              </p>

              {lfgJoinersLoading ? (
                <p style={{ fontSize: 14, color: clr.textMid, fontStyle: 'italic', margin: 0 }}>Loading…</p>
              ) : lfgJoiners.length === 0 ? (
                <p style={{ fontSize: 14, color: clr.textMid, fontStyle: 'italic', margin: 0 }}>
                  {lfgSheetPost.mine ? 'No one yet — hang tight.' : 'No one has joined yet. Be the first.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lfgJoiners.map(j => (
                    <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 16, backgroundColor: clr.bg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={avatarFor({ avatar_url: j.avatar, name: j.name })} alt={j.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: clr.textDark }}>{j.name}</span>
                      </div>
                      {j.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const chatId = await startDM({ id: j.id, name: j.name })
                              setLfgSheetPost(null)
                              navigate(`/chat/${chatId}`)
                            } catch (err) {
                              console.error('[Feed] startDM to joiner failed', err)
                            }
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: 999, border: `1.5px solid ${clr.indigo}`,
                            backgroundColor: clr.white, color: clr.indigo, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          Message →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {lfgSheetPost.mine && !lfgSheetPost.photoUrl && (
              <label style={{
                width: '100%', minHeight: 48, borderRadius: 999, marginBottom: 10, boxSizing: 'border-box',
                border: `1.5px solid ${clr.border}`, background: 'transparent', color: clr.textDark,
                fontSize: 15, fontWeight: 700, cursor: lfgPhotoBusy ? 'default' : 'pointer', opacity: lfgPhotoBusy ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Camera size={17} /> {lfgPhotoBusy ? 'Adding photo…' : 'Add a photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={lfgPhotoBusy} style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setLfgPhotoBusy(true)
                    try {
                      const path = await attachLfgPhoto({ postId: lfgSheetPost.id, userId: currentUser?.id, file })
                      const [withUrl] = await withLfgPhotoUrls([{ ...lfgSheetPost, photoPath: path }])
                      setLfgSheetPost(withUrl)
                      refreshLfg()
                    } catch (err) {
                      console.error('[Feed] add photo failed', err)
                      showToast("Couldn't add the photo.")
                    } finally {
                      setLfgPhotoBusy(false)
                    }
                  }} />
              </label>
            )}
            {lfgSheetPost.mine && (
              <button
                type="button"
                onClick={async () => {
                  const res = await shareLink({
                    url: checkinShareUrl(lfgSheetPost.id),
                    title: lfgSheetPost.activity,
                    text: `I'm free: ${lfgSheetPost.activity}${lfgSheetPost.placeName ? ` at ${lfgSheetPost.placeName}` : ''}. Come through`,
                  })
                  if (res === 'copied') showToast('Link copied')
                }}
                style={{
                  width: '100%', padding: '14px 0', marginBottom: 10, borderRadius: 999, border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white, color: clr.textDark, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Share link
              </button>
            )}
            {lfgSheetPost.mine ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await cancelLfgPost(lfgSheetPost.id)
                    removeLfgPhoto(lfgSheetPost.photoPath)
                    await refreshLfg()
                    setLfgSheetPost(null)
                    showToast('LFG post cancelled')
                  } catch (err) {
                    console.error('[Feed] cancelLfgPost failed', err)
                  }
                }}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 999, border: 'none',
                  backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                }}
              >
                Cancel post
              </button>
            ) : !joinedLfg.some(p => p.id === lfgSheetPost.id) ? (
              // Someone else's post I haven't joined: join it (used to say "You're in").
              <button
                type="button"
                disabled={lfgJoining}
                onClick={async () => {
                  setLfgJoining(true)
                  try {
                    await joinLfgPost(lfgSheetPost.id)
                    await refreshLfg()
                    setLfgSheetPost(null)
                    showToast(`You're in — say hi to ${(lfgSheetPost.authorName || '').split(' ')[0] || 'them'}`)
                  } catch (err) {
                    console.error('[Feed] joinLfgPost failed', err)
                    showToast(/expired/i.test(err?.message) ? 'This one already wrapped up.' : 'Could not join. Please try again.')
                  } finally {
                    setLfgJoining(false)
                  }
                }}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 999, border: 'none',
                  backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 800,
                  cursor: lfgJoining ? 'default' : 'pointer', opacity: lfgJoining ? 0.7 : 1,
                }}
              >
                {lfgJoining ? 'Joining…' : "I'm in"}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await leaveLfgPost(lfgSheetPost.id)
                    await refreshLfg()
                    setLfgSheetPost(null)
                    showToast('Left LFG post')
                  } catch (err) {
                    console.error('[Feed] leaveLfgPost failed', err)
                  }
                }}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 999, border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white, color: clr.textDark, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Leave
              </button>
            )}
          </div>
        </div>
      )}


      {/* Modals for Phase 2 */}
      {/* Onboarding Modal */}
      {(() => {
        if (!currentUser || onboardingDismissed) return null
        const needsCelebration = !!recentInviter
        // intentCapturedAt now loads correctly (H6), so this is the real signal.
        const needsOnboarding = currentUser.intentCapturedAt == null
        if (needsOnboarding) {
          return <OnboardingFlow onDone={() => { if (!needsCelebration) setOnboardingDismissed(true) }} />
        }
        if (!needsCelebration) return null
        return (
          <OnboardingModal
            inviter={recentInviter}
            showIntent={false}
            onClose={() => setOnboardingDismissed(true)}
          />
        )
      })()}
    </div>
  )
}

