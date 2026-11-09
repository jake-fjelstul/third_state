import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAppContext } from '../../context/AppContext.jsx'
import { START_TOUR_EVENT, consumeTourRequest, markTourSeen, tourSeen } from '../../lib/tourBus.js'

/*
 * First-run tour: a spotlight glides from one control to the next with a
 * short explanation. Shown once after onboarding; replayable from Settings.
 * Steps whose target is not on screen are skipped.
 */
const STEPS = [
  { target: 'wheel', title: 'Start something', body: 'Tap a slice to start a circle, host an event, invite someone for coffee or post that you are free.' },
  { target: 'status', title: "Say you're free", body: 'Tap + to tell friends you are free right now. People who are free show up in a row at the top of Home.' },
  { target: 'battery', title: 'Your social battery', body: 'It fills up when you meet people and drains when you go quiet. Tap it to see what changed.' },
  { target: 'search', title: 'Search everything', body: 'Tap to meet new people and find circles, or type something like "chess" to jump straight in.' },
  { target: 'tab-circles', title: 'Circles', body: 'Communities built around what you like. Join one or start your own.' },
  { target: 'tab-schedule', title: 'Schedule', body: 'Your events and meetups in one calendar, plus when friends are free.' },
  { target: 'tab-chat', title: 'Messages', body: 'Chats with friends and circles, with polls, questions and games built in.' },
]

const PAD = 8
const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }

const find = (name) => document.querySelector(`[data-tour="${name}"]`)
const somethingOpen = () => !!document.querySelector('[data-sheet], .ts-sheet-up, [role="dialog"], [data-onboarding]')

function measure(el) {
  const r = el.getBoundingClientRect()
  const round = Math.abs(r.width - r.height) < 12
  return {
    top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2,
    radius: round ? (Math.max(r.width, r.height) + PAD * 2) / 2 : 18,
  }
}

export default function AppTour() {
  const { currentUser } = useAppContext()
  const location = useLocation()
  const reduced = useReducedMotion()
  const [steps, setSteps] = useState(null) // null = not running
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const overlayRef = useRef(null)
  const uid = currentUser?.id
  const onboarded = !!currentUser?.intentCapturedAt
  const onHome = location.pathname === '/feed'

  const start = useCallback(() => {
    const present = STEPS.filter(s => find(s.target))
    if (present.length === 0) return false
    window.scrollTo(0, 0)
    setIndex(0)
    setSteps(present)
    return true
  }, [])

  // Wait until Home is on screen with nothing covering it, then begin.
  const [wanted, setWanted] = useState(false)
  useEffect(() => {
    const onRequest = () => { if (consumeTourRequest()) setWanted(true) }
    window.addEventListener(START_TOUR_EVENT, onRequest)
    onRequest()
    return () => window.removeEventListener(START_TOUR_EVENT, onRequest)
  }, [])
  useEffect(() => {
    if (steps || !uid || !onboarded || !onHome) return
    if (!wanted && tourSeen(uid)) return
    let tries = 0
    const id = setInterval(() => {
      tries += 1
      if (tries > 60) { clearInterval(id); return }
      if (somethingOpen() || !find('wheel')) return
      if (start()) { clearInterval(id); setWanted(false) }
    }, 700)
    return () => clearInterval(id)
  }, [steps, uid, onboarded, onHome, wanted, start])

  const finish = useCallback(() => {
    if (uid) markTourSeen(uid)
    setSteps(null)
    setRect(null)
  }, [uid])

  const step = steps?.[index]

  useLayoutEffect(() => {
    if (!step) return
    const update = () => {
      const el = find(step.target)
      if (el) setRect(measure(el))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [step])

  // Leaving Home (a push tap, a link) ends the tour quietly.
  useEffect(() => { if (steps && !onHome) finish() }, [steps, onHome, finish])

  // The page behind must not scroll while the tour is up.
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const stop = (e) => e.preventDefault()
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [steps])

  if (!steps || !step || !rect) return null

  const last = index === steps.length - 1
  const next = () => (last ? finish() : setIndex(i => i + 1))
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(320, vw - 32)
  const below = rect.top + rect.height / 2 < vh / 2
  const cardLeft = Math.max(16, Math.min(vw - cardW - 16, rect.left + rect.width / 2 - cardW / 2))
  const cardPos = below
    ? { top: rect.top + rect.height + 14 }
    : { bottom: vh - rect.top + 14 }
  const move = reduced ? { duration: 0 } : SPRING

  return createPortal(
    <motion.div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      style={{ position: 'fixed', inset: 0, zIndex: 900, touchAction: 'none' }}
      onClick={next}
    >
      {/* The spotlight: a clear hole whose shadow dims everything else. */}
      <motion.div
        initial={false}
        animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: rect.radius }}
        transition={move}
        style={{
          position: 'fixed', pointerEvents: 'none',
          boxShadow: '0 0 0 200vmax rgba(0,0,0,0.66), 0 0 0 1.5px rgba(255,255,255,0.55) inset',
        }}
      />

      <motion.div
        initial={false}
        animate={{ left: cardLeft }}
        transition={move}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', width: cardW, ...cardPos }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.target}
            initial={reduced ? false : { opacity: 0, y: below ? -8 : 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            style={{
              background: 'var(--white)', color: 'var(--textDark)', borderRadius: 20, padding: '16px 16px 12px',
              boxShadow: '0 0 0 0.5px rgba(255,255,255,0.12), 0 18px 44px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{step.title}</div>
            <p style={{ margin: '6px 0 14px', fontSize: 15, lineHeight: 1.4, color: 'var(--textMid)' }}>{step.body}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 5, flex: 1 }} aria-label={`Step ${index + 1} of ${steps.length}`}>
                {steps.map((s, i) => (
                  <span key={s.target} style={{
                    width: i === index ? 16 : 6, height: 6, borderRadius: 3,
                    background: i === index ? 'var(--accent)' : 'var(--surface-3)',
                    transition: reduced ? 'none' : 'width 0.25s ease, background-color 0.25s ease',
                  }} />
                ))}
              </div>
              {!last && (
                <button type="button" onClick={finish} style={{
                  height: 40, padding: '0 12px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, color: 'var(--textMid)', fontFamily: 'inherit',
                }}>Skip</button>
              )}
              <button type="button" onClick={next} style={{
                height: 40, padding: '0 18px', border: 'none', borderRadius: 999, cursor: 'pointer',
                background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              }}>{last ? 'Done' : 'Next'}</button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body
  )
}
