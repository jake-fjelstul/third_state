import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronRight, Minus, Plus } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import { getWeeklyGoal, listBatteryHistory, relativeTime, setWeeklyGoal } from '../../lib/battery.js'
import { useHardwareBack } from '../../lib/hardwareBack.js'
import { batteryLevel, ExplainerSheet } from './SocialBattery.jsx'

const stepBtn = (disabled) => ({
  width: 32, height: 32, borderRadius: '50%', border: 'none', padding: 0, flexShrink: 0,
  background: 'var(--surface-3)', color: 'var(--textDark)', opacity: disabled ? 0.35 : 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
})

const SIZE = 30
const STROKE = 3

/**
 * Social battery as a small progress ring in the top bar (issue 3).
 * Tap for a minimal dropdown: status word, five-segment bar, this week's
 * meetup goal (adjustable, with a streak), the last three changes, and a link
 * to the explainer. A green tick on the ring means the week's goal is reached.
 */
export default function BatteryWidget() {
  const { batteryPoints, currentUser, refreshProfile } = useAppContext()
  const reduced = useReducedMotion()
  const points = Math.max(0, Math.min(100, batteryPoints ?? 0))
  const level = batteryLevel(points)
  const [open, setOpen] = useState(false)
  const [explainer, setExplainer] = useState(false)
  const [history, setHistory] = useState(null)
  const [anchor, setAnchor] = useState(null)
  const btnRef = useRef(null)
  const [goal, setGoal] = useState(null) // { target, count, met, streak }

  // The weekly goal loads at launch, whenever the battery moves (a meetup
  // just counted) and each time the popup opens.
  useEffect(() => {
    if (!currentUser?.id) return
    let cancelled = false
    getWeeklyGoal()
      .then(g => {
        if (cancelled || !g) return
        setGoal(prev => {
          // Reaching the goal adds battery server-side; pull the new value once.
          if (g.met && prev && !prev.met) refreshProfile?.()?.catch?.(() => {})
          return g
        })
      })
      .catch(err => console.error('[BatteryWidget] weekly goal failed', err))
    return () => { cancelled = true }
  }, [currentUser?.id, points, open, refreshProfile])

  const changeTarget = (delta) => {
    if (!goal) return
    const next = Math.max(1, Math.min(5, goal.target + delta))
    if (next === goal.target) return
    setGoal({ ...goal, target: next }) // instant; the server answer follows
    setWeeklyGoal(next)
      .then(g => { if (g) setGoal(g) })
      .catch(err => console.error('[BatteryWidget] set goal failed', err))
  }

  const close = useCallback(() => setOpen(false), [])
  const closeExplainer = useCallback(() => setExplainer(false), [])
  useHardwareBack(open && !explainer, close)
  useHardwareBack(explainer, closeExplainer)

  useEffect(() => {
    if (!open || !currentUser?.id) return
    let cancelled = false
    listBatteryHistory(currentUser.id, 3)
      .then(rows => { if (!cancelled) setHistory(rows) })
      .catch(err => console.error('[BatteryWidget] history failed', err))
    return () => { cancelled = true }
  }, [open, currentUser?.id, points])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setAnchor({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right - 6) })
    setOpen(o => !o)
  }

  const r = (SIZE - STROKE) / 2
  const c = 2 * Math.PI * r
  const filled = Math.round((points / 100) * 5)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={`Social battery ${points}, ${level.word}`}
        aria-expanded={open}
        data-tour="battery"
        style={{
          width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          color: 'var(--textDark)',
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={STROKE}
            strokeLinecap="round" strokeDasharray={`${(c * points) / 100} ${c}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: reduced ? 'none' : 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.02em', position: 'relative' }}>{points}</span>
        <AnimatePresence>
          {goal?.met && (
            <motion.span
              key="met"
              aria-hidden="true"
              initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              style={{
                position: 'absolute', right: 3, bottom: 5, width: 14, height: 14, borderRadius: '50%',
                background: 'var(--good)', color: '#FFFFFF', boxShadow: '0 0 0 2px var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Check size={9} strokeWidth={4} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && anchor && (
            <>
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={close}
                style={{ position: 'fixed', inset: 0, zIndex: 150, backgroundColor: 'rgba(0,0,0,0.08)' }}
              />
              <motion.div
                key="pop"
                role="dialog"
                aria-label="Social battery"
                initial={reduced ? false : { opacity: 0, scale: 0.96, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                style={{
                  position: 'fixed', zIndex: 151, top: anchor.top, right: anchor.right,
                  width: 'min(300px, calc(100vw - 24px))', transformOrigin: 'top right',
                  backgroundColor: 'var(--white)', color: 'var(--textDark)', borderRadius: 18, padding: 16,
                  boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08), 0 18px 40px rgba(0,0,0,0.18)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--textMid)', fontWeight: 500 }}>Social battery</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>{level.word}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>{points}</div>
                </div>

                <div style={{ display: 'flex', gap: 4, margin: '12px 0 10px' }} aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 3,
                      backgroundColor: i < filled ? 'var(--accent)' : 'var(--surface-3)',
                    }} />
                  ))}
                </div>

                {goal && (
                  <div style={{ padding: '10px 0 12px', margin: '0 0 6px', borderTop: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--textMid)', fontWeight: 500 }}>This week's goal</div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                          {goal.met ? 'Goal reached' : `${Math.min(goal.count, goal.target)} of ${goal.target} ${goal.target === 1 ? 'meetup' : 'meetups'}`}
                        </div>
                      </div>
                      <button type="button" aria-label="Lower weekly goal" disabled={goal.target <= 1} onClick={() => changeTarget(-1)} style={stepBtn(goal.target <= 1)}><Minus size={16} /></button>
                      <span aria-label={`Goal: ${goal.target} a week`} style={{ width: 16, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{goal.target}</span>
                      <button type="button" aria-label="Raise weekly goal" disabled={goal.target >= 5} onClick={() => changeTarget(1)} style={stepBtn(goal.target >= 5)}><Plus size={16} /></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }} aria-hidden="true">
                      {Array.from({ length: goal.target }, (_, i) => (
                        <motion.span
                          key={i} layout={!reduced}
                          animate={{ backgroundColor: i < goal.count ? 'var(--good)' : 'var(--surface-3)' }}
                          transition={{ duration: 0.25 }}
                          style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}
                        >
                          {i < goal.count && <Check size={12} strokeWidth={3.5} />}
                        </motion.span>
                      ))}
                      <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--textMid)' }}>
                        {goal.streak > 0 ? `${goal.streak} ${goal.streak === 1 ? 'week' : 'weeks'} in a row` : 'Events, coffee, "I\'m free"'}
                      </span>
                    </div>
                  </div>
                )}

                {history === null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                    {[0, 1, 2].map(i => <div key={i} className="ts-skeleton" style={{ height: 18, borderRadius: 6 }} />)}
                  </div>
                ) : history.length === 0 ? (
                  <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--textMid)' }}>{level.hint}</p>
                ) : (
                  history.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                      <span style={{
                        width: 34, fontWeight: 700, fontSize: 14,
                        color: h.points >= 0 ? 'var(--good)' : 'var(--textLight)',
                      }}>
                        {h.points >= 0 ? `+${h.points}` : `−${Math.abs(h.points)}`}
                      </span>
                      <span style={{ flex: 1, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason}</span>
                      <span style={{ fontSize: 13, color: 'var(--textLight)', flexShrink: 0 }}>{relativeTime(h.createdAt)}</span>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={() => { setOpen(false); setExplainer(true) }}
                  style={{
                    width: '100%', marginTop: 8, padding: '12px 0 2px', minHeight: 40,
                    borderTop: '0.5px solid var(--border)', borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                    background: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: 15, color: 'var(--textMid)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span>How it works</span>
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>{explainer && <ExplainerSheet onClose={closeExplainer} />}</AnimatePresence>,
        document.body
      )}
    </>
  )
}
