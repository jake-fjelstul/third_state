import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, MapPin, Share as ShareIcon } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { useStableNavigate } from '../lib/useStableNavigate.js'
import { rememberPendingLink, shareLink } from '../lib/share.js'
import { getTimePoll, publicTimePollCard, voteTimePoll, makeEventFromPoll, optionLabel, pollShareUrl } from '../lib/timePolls.js'

/*
 * /p/:id — "When works?" (plan Part 4). Signed in: tap every time that works;
 * whoever asked can lock one in, which makes a real event and RSVPs everyone
 * who picked it. Signed out: the times and counts, and a way to sign in.
 */
export default function PollLanding() {
  const { id } = useParams()
  const navigate = useStableNavigate()
  const { session, authLoading, refreshMeetups } = useAppContext()
  const signedIn = !!session?.user?.id
  const [poll, setPoll] = useState(undefined)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setPoll(signedIn ? await getTimePoll(id) : await publicTimePollCard(id))
    } catch {
      setPoll(null)
    }
  }, [id, signedIn])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])

  const toggle = async (opt) => {
    if (!signedIn) { rememberPendingLink(`/p/${id}`); navigate('/auth?invited=1'); return }
    setBusy(opt.index); setError('')
    try { setPoll(await voteTimePoll(id, opt.index, !opt.mine)) }
    catch (err) { setError(/already set/i.test(err?.message) ? 'The time is already set.' : "Couldn't save your vote.") }
    finally { setBusy(null) }
  }

  const lockIn = async (opt) => {
    if (!window.confirm(`Make ${optionLabel(opt.at)} the plan? Everyone who picked it will be going.`)) return
    setBusy(`set-${opt.index}`); setError('')
    try {
      await makeEventFromPoll(id, opt.index)
      refreshMeetups?.()
      await load()
    } catch { setError("Couldn't set the time. Try again.") }
    finally { setBusy(null) }
  }

  if (authLoading || poll === undefined) return <Shell><p style={{ color: 'var(--textMid)' }}>Opening…</p></Shell>
  if (!poll) {
    return (
      <Shell>
        <Card>
          <h1 style={h1}>This poll isn't available</h1>
          <p style={sub}>It may have been removed.</p>
          <Primary onClick={() => navigate(signedIn ? '/feed' : '/auth')}>Open Third Space</Primary>
        </Card>
      </Shell>
    )
  }

  const set = !!(poll.eventId || poll.set)
  const best = Math.max(0, ...poll.options.map(o => o.count))
  return (
    <Shell>
      <Card>
        <p style={kicker}>When works?</p>
        <h1 style={h1}>{poll.title}</h1>
        {poll.place && <p style={{ ...sub, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px' }}><MapPin size={15} /> {poll.place}</p>}
        <p style={{ ...sub, fontSize: 13, margin: '0 0 14px' }}>
          {poll.hostFirstName ? `${poll.hostFirstName} asked` : 'Asked'} · {set ? 'time is set' : 'tap every time that works'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {poll.options.map((o, i) => {
            const opt = { ...o, index: o.index ?? i }
            const top = o.count > 0 && o.count === best
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <button type="button" disabled={set || busy !== null} onClick={() => toggle(opt)} style={{
                  flex: 1, minHeight: 56, padding: '10px 14px', borderRadius: 14, textAlign: 'left', cursor: set ? 'default' : 'pointer',
                  border: o.mine ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: o.mine ? 'var(--accent-soft)' : 'var(--surface-2)', color: 'var(--textDark)', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 10, opacity: busy === opt.index ? 0.6 : 1,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: o.mine ? 'var(--accent)' : 'transparent', border: o.mine ? 'none' : '1.5px solid var(--border)', color: 'var(--on-accent)',
                  }}>{o.mine && <Check size={15} strokeWidth={3} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{optionLabel(o.at)}</span>
                    <span style={{ display: 'block', fontSize: 13, color: top ? 'var(--accent)' : 'var(--textMid)', fontWeight: top ? 600 : 500 }}>
                      {o.count} {o.count === 1 ? 'person' : 'people'}{o.names?.length ? ` · ${o.names.slice(0, 3).join(', ')}${o.names.length > 3 ? ` +${o.names.length - 3}` : ''}` : ''}
                    </span>
                  </span>
                </button>
                {poll.mine && !set && (
                  <button type="button" disabled={busy !== null} onClick={() => lockIn(opt)} style={{
                    flexShrink: 0, padding: '0 12px', borderRadius: 14, border: 'none', background: 'var(--indigo)', color: 'var(--on-ink)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{busy === `set-${opt.index}` ? '…' : 'Pick'}</button>
                )}
              </div>
            )
          })}
        </div>

        {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>{error}</p>}

        {!signedIn ? (
          <Primary onClick={() => { rememberPendingLink(`/p/${id}`); navigate('/auth?invited=1') }}>Sign in to vote</Primary>
        ) : set ? (
          <Primary onClick={() => navigate('/schedule')}>It's on · see it in Schedule</Primary>
        ) : (
          <button type="button" onClick={() => shareLink({ url: pollShareUrl(id), title: poll.title, text: `When works for ${poll.title}?` })} style={{
            width: '100%', height: 46, marginTop: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--textDark)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}><ShareIcon size={16} /> Share poll</button>
        )}
        {signedIn && (
          <button type="button" onClick={() => navigate('/feed')} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--textMid)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Go to Third Space
          </button>
        )}
      </Card>
    </Shell>
  )
}

const kicker = { margin: '0 0 6px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }
const h1 = { margin: '0 0 8px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--textDark)' }
const sub = { margin: 0, fontSize: 15, color: 'var(--textMid)', lineHeight: 1.45 }

function Primary({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', height: 50, marginTop: 16, borderRadius: 14, border: 'none', background: 'var(--accent)',
      color: 'var(--on-accent)', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  )
}

function Card({ children }) {
  return (
    <div style={{
      width: '100%', maxWidth: 440, background: 'var(--white)', borderRadius: 24, padding: 22,
      border: '0.5px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    }}>{children}</div>
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
