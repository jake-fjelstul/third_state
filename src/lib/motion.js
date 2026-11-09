// Shared motion presets (item 9). Everything respects prefers-reduced-motion:
// components call useReducedMotion() and pass `reduced` where relevant.

export const springs = {
  page: { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 },
  sheet: { type: 'spring', stiffness: 380, damping: 32 },
  pop: { type: 'spring', stiffness: 500, damping: 30 },
}

/** iOS-style push: new page slides in from the right over a dimmed old one. */
export const pageSlide = {
  enter: (dir) => (dir > 0
    ? { x: '100%', opacity: 1, zIndex: 2, boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' }
    : dir < 0
      ? { x: '-25%', opacity: 0.7, zIndex: 1 }
      : { opacity: 0, zIndex: 1 }),
  center: { x: 0, opacity: 1, zIndex: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
  exit: (dir) => (dir > 0
    ? { x: '-25%', opacity: 0.7, zIndex: 0 }
    : dir < 0
      ? { x: '100%', opacity: 1, zIndex: 3, boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' }
      : { opacity: 0, zIndex: 0 }),
}

export const sheetUp = {
  initial: { y: '100%' },
  animate: { y: 0, transition: springs.sheet },
  exit: { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
}

export const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: springs.pop },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
}

export const listStagger = {
  container: { animate: { transition: { staggerChildren: 0.03 } } },
  item: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
    exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: 0.2 } },
  },
}

/** Spread onto a motion.button / motion.div for a press effect. */
export const press = { whileTap: { scale: 0.97 }, transition: { duration: 0.1 } }

// Route depth decides push vs pop vs fade.
const ROOT_ROUTES = ['/feed', '/circles', '/schedule', '/chat', '/profile']
export function routeDepth(pathname) {
  if (ROOT_ROUTES.includes(pathname)) return 0
  if (/^\/(chat|circles|user|game)\/[^/]+/.test(pathname)) return 1
  return 1 // settings, notifications, memories: pushed screens
}

/** Light haptic tap on native; no-op on web. */
export function haptic(style = 'Light') {
  import('@capacitor/haptics')
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle[style] || ImpactStyle.Light }))
    .catch(() => {})
}
