import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion, useTransform } from 'framer-motion'
import { TabActiveContext } from '../../lib/tabActive.js'
import ScreenErrorBoundary from './ScreenErrorBoundary.jsx'

/*
 * App shell (issues 2, 5, 6).
 *
 * - The five tab pages stay mounted after their first visit and are only
 *   hidden, so switching tabs is instant and keeps scroll position.
 * - Everything else (a chat thread, a circle, a profile...) is a pushed
 *   screen: a full-screen layer that slides over whatever was underneath.
 *   The page underneath is the real, still-mounted page, so going back never
 *   reloads anything.
 * - Pushed screens can be dragged back from the left edge with your finger,
 *   like iOS, revealing the page underneath as you go.
 */

export const TAB_ROOTS = ['/feed', '/circles', '/schedule', '/chat', '/profile']
const PARENT_TAB = {
  chat: '/chat', game: '/chat', circles: '/circles', user: '/feed',
  settings: '/profile', notifications: '/feed', memories: '/circles',
}
const isTabRoot = (p) => TAB_ROOTS.includes(p)
const parentTabFor = (p) => PARENT_TAB[p.split('/')[1]] || '/feed'
const keyOf = (loc) => loc.key || `${loc.pathname}${loc.search}`
const rootLoc = (pathname) => ({ pathname, search: '', hash: '', state: null, key: `root:${pathname}` })

const EDGE = 30           // px from the left edge where a swipe-back can start
const SPRING = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 }

function Fallback() {
  return <div style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)' }} />
}

/* One pushed screen. Owns its own x; drives the layer beneath it. */
function StackLayer({ loc, routes, zIndex, isTop, underKey, getEl, onSwipeBack, selfHeaded, locked, registerEl }) {
  const reduced = useReducedMotion()
  const width = typeof window !== 'undefined' ? window.innerWidth : 390
  const x = useMotionValue(reduced ? 0 : width)
  const scrimOpacity = useTransform(x, [0, width], [0.22, 0])
  const elRef = useRef(null)
  const isTopRef = useRef(isTop)
  const [isPresent, safeToRemove] = usePresence()
  const getUnder = useCallback(() => getEl(underKey), [getEl, underKey])

  useEffect(() => { isTopRef.current = isTop }, [isTop])
  useEffect(() => { registerEl(keyOf(loc), elRef.current); return () => registerEl(keyOf(loc), null) }, [loc, registerEl])

  // Parallax + dim for the page underneath while this one moves.
  useEffect(() => {
    const apply = (v) => {
      if (!isTopRef.current) return
      const under = getUnder()
      if (!under) return
      const p = Math.max(0, Math.min(1, v / width))
      under.style.transform = p >= 1 ? '' : `translateX(${-(1 - p) * width * 0.25}px)`
    }
    const unsub = x.on('change', apply)
    apply(x.get())
    return () => {
      unsub()
      const under = getUnder()
      if (under && isTopRef.current) under.style.transform = ''
    }
  }, [x, width, getUnder])

  // Slide in on mount; slide out before React removes us.
  useEffect(() => {
    const c = animate(x, 0, reduced ? { duration: 0 } : SPRING)
    return () => c.stop()
  }, [x, reduced])
  useEffect(() => {
    if (isPresent) return
    const c = animate(x, width, reduced ? { duration: 0 } : { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.28 })
    c.then(() => safeToRemove?.())
    return () => c.stop()
  }, [isPresent, x, width, reduced, safeToRemove])

  // Edge swipe-back with native, non-passive listeners so we can stop the
  // page from scrolling once the gesture is clearly horizontal.
  useEffect(() => {
    const el = elRef.current
    if (!el || !isTop) return
    let s = null
    const onStart = (e) => {
      const t = e.touches[0]
      if (e.touches.length !== 1 || t.clientX > EDGE) { s = null; return }
      s = { x0: t.clientX, y0: t.clientY, lastX: t.clientX, lastT: performance.now(), v: 0, swiping: false }
    }
    const onMove = (e) => {
      if (!s) return
      const t = e.touches[0]
      const dx = t.clientX - s.x0
      const dy = t.clientY - s.y0
      if (!s.swiping) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s = null; return }
        if (dx < 8) return
        s.swiping = true
      }
      e.preventDefault()
      const now = performance.now()
      s.v = (t.clientX - s.lastX) / Math.max(1, now - s.lastT)
      s.lastX = t.clientX
      s.lastT = now
      x.set(Math.max(0, dx))
    }
    const onEnd = () => {
      if (!s?.swiping) { s = null; return }
      const done = x.get() > width * 0.33 || s.v > 0.5
      s = null
      if (done) {
        animate(x, width, { type: 'tween', ease: 'easeOut', duration: 0.18 }).then(onSwipeBack)
      } else {
        animate(x, 0, SPRING)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [isTop, x, width, onSwipeBack])

  return (
    <>
      <motion.div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: zIndex - 1, backgroundColor: '#000',
        opacity: scrimOpacity, pointerEvents: 'none',
      }} />
      <motion.div
        ref={elRef}
        style={{
          x,
          position: 'fixed', inset: 0, zIndex,
          backgroundColor: 'var(--bg)',
          // Fixed-height screens (chat thread, games) handle their own
          // scrolling; letting the layer scroll too made them rubber-band.
          overflowY: locked ? 'hidden' : 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
          paddingTop: selfHeaded ? 0 : 'env(safe-area-inset-top)',
          paddingBottom: selfHeaded ? 0 : 'calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: '100%', maxWidth: selfHeaded ? 'none' : 900, margin: '0 auto' }}>
          <ScreenErrorBoundary onBack={onSwipeBack}>
            <Suspense fallback={<Fallback />}>
              <Routes location={loc}>{routes}</Routes>
            </Suspense>
          </ScreenErrorBoundary>
        </div>
      </motion.div>
    </>
  )
}

export default function AppShell({ tabElements, pushedRoutes, selfHeadedPrefixes = [], lockedPrefixes = [], topNav, bottomNav, extras }) {
  const location = useLocation()
  const navType = useNavigationType()
  const navigate = useNavigate()

  const initialTab = isTabRoot(location.pathname) ? location.pathname : parentTabFor(location.pathname)
  const [state, setState] = useState(() => ({
    seenKey: keyOf(location),
    activeTab: initialTab,
    tabLocs: { [initialTab]: isTabRoot(location.pathname) ? location : rootLoc(initialTab) },
    stack: isTabRoot(location.pathname) ? [] : [location],
  }))

  // Derive the tab/stack state from navigation, during render (no effects).
  if (state.seenKey !== keyOf(location)) {
    const next = { ...state, seenKey: keyOf(location) }
    if (isTabRoot(location.pathname)) {
      next.activeTab = location.pathname
      next.tabLocs = { ...state.tabLocs, [location.pathname]: location }
      next.stack = []
    } else if (navType === 'POP') {
      const i = state.stack.findIndex(l => keyOf(l) === keyOf(location))
      next.stack = i >= 0 ? state.stack.slice(0, i + 1) : [...state.stack, location]
    } else if (navType === 'REPLACE' && state.stack.length) {
      next.stack = [...state.stack.slice(0, -1), location]
    } else {
      next.stack = [...state.stack, location]
    }
    if (!next.tabLocs[next.activeTab]) next.tabLocs = { ...next.tabLocs, [next.activeTab]: rootLoc(next.activeTab) }
    setState(next)
  }
  const { activeTab, tabLocs, stack } = state

  // Each tab keeps its own scroll position.
  const scrollByTab = useRef({})
  const prevTab = useRef(activeTab)
  useLayoutEffect(() => {
    if (prevTab.current === activeTab) return
    scrollByTab.current[prevTab.current] = window.scrollY
    prevTab.current = activeTab
    window.scrollTo(0, scrollByTab.current[activeTab] || 0)
  }, [activeTab])

  const tabLayerRef = useRef(null)
  const layerEls = useRef(new Map())
  const registerEl = useCallback((key, el) => {
    if (el) layerEls.current.set(key, el)
    else layerEls.current.delete(key)
  }, [])
  const getEl = useCallback((key) => (key ? layerEls.current.get(key) : tabLayerRef.current), [])
  const onSwipeBack = useCallback(() => navigate(-1), [navigate])

  const visitedTabs = TAB_ROOTS.filter(r => tabLocs[r])

  return (
    <>
      {topNav}

      <div ref={tabLayerRef} style={{ willChange: stack.length ? 'transform' : 'auto' }}>
        {visitedTabs.map(r => (
          <div key={r} style={{ display: r === activeTab ? 'block' : 'none' }}>
            <TabActiveContext.Provider value={r === activeTab && stack.length === 0}>
              <div style={{
                minHeight: '100vh',
                paddingTop: 'calc(60px + env(safe-area-inset-top))',
                paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
                backgroundColor: 'var(--bg)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <div style={{ width: '100%', maxWidth: 900 }}>
                  <ScreenErrorBoundary>
                    <Suspense fallback={<Fallback />}>
                      <Routes location={tabLocs[r]}>
                        <Route path={r} element={tabElements[r]} />
                      </Routes>
                    </Suspense>
                  </ScreenErrorBoundary>
                </div>
              </div>
            </TabActiveContext.Provider>
          </div>
        ))}
      </div>

      {bottomNav}

      <AnimatePresence initial={false}>
        {stack.map((loc, i) => {
          return (
            <StackLayer
              key={keyOf(loc)}
              loc={loc}
              routes={pushedRoutes}
              zIndex={200 + i * 2}
              isTop={i === stack.length - 1}
              underKey={i > 0 ? keyOf(stack[i - 1]) : null}
              getEl={getEl}
              onSwipeBack={onSwipeBack}
              selfHeaded={selfHeadedPrefixes.some(p => loc.pathname.startsWith(p))}
              locked={lockedPrefixes.some(p => loc.pathname.startsWith(p))}
              registerEl={registerEl}
            />
          )
        })}
      </AnimatePresence>

      {extras}
    </>
  )
}
