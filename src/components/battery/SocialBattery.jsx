import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HelpCircle, ChevronDown } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import { listBatteryHistory, relativeTime } from '../../lib/battery.js'
import { useHardwareBack } from '../../lib/hardwareBack.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

const SEEN_KEY = 'ts.battery.explainerSeen'
const SEGMENTS = 5

/**
 * Plain-language levels (items 6 and 16). Flat colors, no glow: the word
 * says what the number means.
 */
export function batteryLevel(points) {
  const p = Math.max(0, Math.min(100, points ?? 0))
  if (p >= 80) return { word: 'Up for anything', hint: "You've been out a lot lately.", color: '#16A34A' }
  if (p >= 60) return { word: 'Social', hint: 'Good momentum. Keep it going.', color: '#4F46E5' }
  if (p >= 40) return { word: 'Open to plans', hint: 'A coffee or an event would top you up.', color: '#0EA5E9' }
  if (p >= 20) return { word: 'Low-key', hint: "It's been quiet. A message to a friend helps.", color: '#D97706' }
  return { word: 'Recharging', hint: 'Join a circle or say hi to someone to start filling up.', color: '#DC2626' }
}

function SegmentedBattery({ points, color }) {
  const filled = Math.round((Math.max(0, Math.min(100, points)) / 100) * SEGMENTS)
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <div style={{
        display: 'flex', gap: 3, padding: 3, borderRadius: 8,
        border: `2px solid ${clr.textDark}`, opacity: 0.9,
      }}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div key={i} style={{
            width: 14, height: 22, borderRadius: 3,
            backgroundColor: i < filled ? color : clr.border,
            transition: 'background-color 0.4s ease',
          }} />
        ))}
      </div>
      <div style={{ width: 4, height: 10, borderRadius: '0 2px 2px 0', backgroundColor: clr.textDark, opacity: 0.9 }} />
    </div>
  )
}

function ExplainerSheet({ onClose }) {
  const reduced = useReducedMotion()
  const row = (title, body) => (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: clr.textDark }}>{title}</p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: clr.textMid }}>{body}</p>
    </div>
  )
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400, backgroundColor: 'rgba(15,15,30,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="battery-explainer-title"
        initial={reduced ? false : { y: '100%' }} animate={{ y: 0 }} exit={reduced ? undefined : { y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, backgroundColor: clr.white, borderRadius: '24px 24px 0 0',
          padding: '22px 22px calc(22px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: clr.border, margin: '0 auto 16px' }} />
        <h2 id="battery-explainer-title" style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800, color: clr.textDark }}>
          Your social battery
        </h2>
        {row('What it is', 'A rough read on how connected you have been lately, from 0 to 100. It is a nudge, not a score.')}
        {row('What fills it', 'Going to events you RSVP’d to (+20), joining a new circle (+15), and messaging people (+5, up to three times a day).')}
        {row('What drains it', 'Days without opening the app, and connections you haven’t seen in a while.')}
        {row('Who can see it', 'Only you.')}
        <button type="button" onClick={onClose} style={{
          width: '100%', minHeight: 48, marginTop: 6, borderRadius: 999, border: 'none',
          backgroundColor: clr.indigo, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}>
          Got it
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function SocialBattery() {
  const { batteryPoints, currentUser } = useAppContext()
  const points = Math.max(0, Math.min(100, batteryPoints ?? 0))
  const level = batteryLevel(points)
  const [showHistory, setShowHistory] = useState(false)
  const [showExplainer, setShowExplainer] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // "+15" fly-up when the number changes.
  const prev = useRef(points)
  const [delta, setDelta] = useState(null)
  useEffect(() => {
    const d = points - prev.current
    prev.current = points
    if (d === 0) return
    setDelta({ value: d, key: Date.now() })
    const t = setTimeout(() => setDelta(null), 1400)
    return () => clearTimeout(t)
  }, [points])

  useEffect(() => {
    if (!showHistory || !currentUser?.id) return
    let cancelled = false
    setHistoryLoading(true)
    listBatteryHistory(currentUser.id, 3)
      .then(rows => { if (!cancelled) setHistory(rows) })
      .catch(err => console.error('[SocialBattery] history load failed', err))
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [showHistory, currentUser?.id, points])

  const closeExplainer = useCallback(() => setShowExplainer(false), [])
  useHardwareBack(showExplainer, closeExplainer)

  const handleTap = () => {
    let seen = false
    try { seen = window.localStorage.getItem(SEEN_KEY) === '1' } catch { /* noop */ }
    if (!seen) {
      try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* noop */ }
      setShowExplainer(true)
      return
    }
    setShowHistory(h => !h)
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        role="button" tabIndex={0}
        onClick={handleTap}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap() } }}
        aria-expanded={showHistory}
        style={{
          backgroundColor: clr.white, borderRadius: showHistory ? '20px 20px 0 0' : 20,
          padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          cursor: 'pointer', position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <SegmentedBattery points={points} color={level.color} />
            <AnimatePresence>
              {delta && (
                <motion.span
                  key={delta.key}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: -18 }}
                  exit={{ opacity: 0, y: -28 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: -4, textAlign: 'center',
                    fontSize: 13, fontWeight: 800, color: delta.value > 0 ? '#16A34A' : '#DC2626',
                    pointerEvents: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {delta.value > 0 ? `+${delta.value}` : delta.value}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: clr.textMid }}>Social battery · {points}</p>
            <p style={{ margin: '1px 0 2px', fontSize: 18, fontWeight: 800, color: clr.textDark }}>{level.word}</p>
            <p style={{ margin: 0, fontSize: 13, color: clr.textMid, lineHeight: 1.35 }}>{level.hint}</p>
          </div>

          <button
            type="button"
            aria-label="What is the social battery?"
            onClick={e => { e.stopPropagation(); setShowExplainer(true) }}
            style={{
              width: 44, height: 44, margin: '-8px -10px -8px 0', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: clr.textLight, cursor: 'pointer',
            }}
          >
            <HelpCircle size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <ChevronDown size={16} color="var(--textLight)" style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden', backgroundColor: clr.white, borderRadius: '0 0 20px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
          >
            <div style={{ padding: '4px 18px 18px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recent changes
              </p>
              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1, 2].map(i => <div key={i} className="ts-skeleton" style={{ height: 40, borderRadius: 12 }} />)}
                </div>
              ) : history.length === 0 ? (
                <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                  Nothing yet. Join a circle, go to an event, or message someone.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(h => {
                    const positive = h.points >= 0
                    return (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 12, backgroundColor: clr.bg }}>
                        <span style={{
                          fontSize: 13, fontWeight: 800, minWidth: 44, textAlign: 'center',
                          color: positive ? '#15803D' : '#B91C1C',
                        }}>
                          {positive ? '+' : '−'}{Math.abs(h.points)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason}</p>
                          <p style={{ margin: 0, fontSize: 12, color: clr.textLight }}>{relativeTime(h.createdAt)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExplainer && <ExplainerSheet onClose={() => setShowExplainer(false)} />}
      </AnimatePresence>
    </section>
  )
}
