import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, MapPin, Users, Zap } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { useStableNavigate } from '../lib/useStableNavigate.js'
import { getPublicCard, rememberPendingLink } from '../lib/share.js'

/*
 * /e/:id and /s/:id (plan Part 4, Layer A).
 * Signed in: open the event / check-in inside the app (Home handles
 * ?event= and ?checkin=). Signed out: a preview card and a way in; the link
 * is remembered and opened once right after sign-in.
 */
export default function ShareLanding({ type }) {
  const { id } = useParams()
  const navigate = useStableNavigate()
  const { session, authLoading } = useAppContext()
  const signedIn = !!session?.user?.id
  const [card, setCard] = useState(undefined) // undefined = loading, null = unavailable

  useEffect(() => {
    if (authLoading) return
    if (signedIn) {
      navigate(`/feed?${type === 'event' ? 'event' : 'checkin'}=${encodeURIComponent(id)}`, { replace: true })
      return
    }
    let cancelled = false
    getPublicCard(type, id)
      .then(c => { if (!cancelled) setCard(c) })
      .catch(() => { if (!cancelled) setCard(null) })
    return () => { cancelled = true }
  }, [authLoading, signedIn, type, id, navigate])

  const goSignIn = () => {
    rememberPendingLink(`/${type === 'event' ? 'e' : 's'}/${id}`)
    navigate('/auth?invited=1')
  }

  if (authLoading || signedIn || card === undefined) {
    return <Shell><p style={{ color: 'var(--textMid)', margin: 0 }}>Opening…</p></Shell>
  }

  return (
    <Shell>
      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--white)', borderRadius: 24, overflow: 'hidden',
        border: '0.5px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}>
        {type === 'event' && card?.coverImageUrl && (
          <img src={card.coverImageUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: 22 }}>
          {!card ? (
            <>
              <h1 style={h1}>{type === 'event' ? 'This event is private or gone' : 'This one wrapped up'}</h1>
              <p style={sub}>Open Third Space to see what your friends are up to.</p>
            </>
          ) : type === 'event' ? (
            <>
              <p style={kicker}>{card.circleName || 'Event'}</p>
              <h1 style={h1}>{card.title}</h1>
              <Row Icon={Calendar}>{new Date(card.startsAt).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Row>
              {card.location && <Row Icon={MapPin}>{card.location}</Row>}
              <Row Icon={Users}>{card.going} going{card.hostFirstName ? ` · hosted by ${card.hostFirstName}` : ''}</Row>
            </>
          ) : card.public ? (
            <>
              <p style={kicker}>Out now</p>
              <h1 style={h1}>{card.hostFirstName || 'Someone'} is at {card.placeName || 'a spot nearby'}</h1>
              <Row Icon={Zap}>{card.activity}</Row>
              <Row Icon={Users}>{card.people} there now</Row>
            </>
          ) : (
            <>
              <p style={kicker}>Out now</p>
              <h1 style={h1}>A friend is out right now</h1>
              <p style={sub}>Sign in to see where and pull up.</p>
            </>
          )}
          <button type="button" onClick={goSignIn} style={{
            width: '100%', height: 50, marginTop: 18, borderRadius: 14, border: 'none', background: 'var(--accent)',
            color: 'var(--on-accent)', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {card ? (type === 'event' ? 'Sign in to RSVP' : 'Sign in to pull up') : 'Open Third Space'}
          </button>
          <p style={{ ...sub, margin: '12px 0 0', textAlign: 'center', fontSize: 13 }}>New here? You can sign up on the next screen.</p>
        </div>
      </div>
    </Shell>
  )
}

const kicker = { margin: '0 0 6px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }
const h1 = { margin: '0 0 12px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--textDark)' }
const sub = { margin: 0, fontSize: 15, color: 'var(--textMid)', lineHeight: 1.45 }

function Row({ Icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0', fontSize: 15, color: 'var(--textMid)' }}>
      <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} /> <span>{children}</span>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 22, padding: 'calc(env(safe-area-inset-top) + 24px) 20px calc(env(safe-area-inset-bottom) + 24px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--textDark)' }}>
        <svg width="28" height="28" viewBox="0 0 56 56" fill="none" aria-hidden="true">
          <circle cx="22" cy="28" r="14" stroke="currentColor" strokeWidth="4" />
          <circle cx="34" cy="28" r="14" stroke="currentColor" strokeWidth="4" />
        </svg>
        <span>third space<span style={{ color: 'var(--accent)' }}>.</span></span>
      </div>
      {children}
    </div>
  )
}
