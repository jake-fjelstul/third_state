/*
 * Drag-to-dismiss for every bottom sheet in the app.
 *
 * Sheets here share two traits: they slide up with the `tsSheetUp` animation
 * (or carry `data-sheet`), and their backdrop closes them when tapped. So one
 * document-level gesture handler covers all of them: drag a sheet down and it
 * follows your finger; let go past a threshold (or flick) and we "tap" its
 * backdrop, which runs that sheet's own close logic. Dragging up rubber-bands.
 *
 * A drag only starts when the content under your finger is scrolled to the
 * top, so scrolling inside a sheet still works normally.
 */

const DISMISS_PX = 110
const DISMISS_VELOCITY = 0.55 // px per ms
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [data-no-sheet-drag], .noscrollbar[data-wheel]'

function findSheet(node) {
  for (let el = node, i = 0; el && el !== document.body && i < 24; el = el.parentElement, i++) {
    if (el.dataset?.sheet !== undefined || el.classList?.contains('ts-sheet-up')) return el
    const anim = el.style?.animation || el.style?.animationName || ''
    if (anim.includes('tsSheetUp')) return el
  }
  return null
}

function findBackdrop(sheet) {
  for (let el = sheet.parentElement, i = 0; el && el !== document.body && i < 4; el = el.parentElement, i++) {
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed') return el
  }
  return null
}

// True if anything between the touch target and the sheet is scrolled down.
function scrolledInside(target, sheet) {
  for (let el = target; el && el !== sheet.parentElement; el = el.parentElement) {
    if (el.scrollTop > 0) return true
  }
  return false
}

export function installSheetSwipe() {
  if (typeof document === 'undefined' || document.__tsSheetSwipe) return
  document.__tsSheetSwipe = true
  let g = null

  const onStart = (e) => {
    g = null
    if (e.touches.length !== 1) return
    const target = e.target
    if (!(target instanceof Element) || target.closest(NO_DRAG)) return
    const sheet = findSheet(target)
    if (!sheet) return
    const backdrop = findBackdrop(sheet)
    if (!backdrop) return
    const t = e.touches[0]
    g = { sheet, backdrop, target, x0: t.clientX, y0: t.clientY, lastY: t.clientY, lastT: performance.now(), v: 0, dragging: false }
  }

  const onMove = (e) => {
    if (!g) return
    const t = e.touches[0]
    const dy = t.clientY - g.y0
    const dx = t.clientX - g.x0
    if (!g.dragging) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { g = null; return }
      if (Math.abs(dy) < 8) return
      // Pulling down only starts a drag from the top of the content.
      if (dy > 0 && scrolledInside(g.target, g.sheet)) { g = null; return }
      // Pulling up while there is content to scroll is a normal scroll.
      if (dy < 0) { g = null; return }
      g.dragging = true
      g.sheet.style.animation = 'none'   // the slide-in animation would override transform
      g.sheet.style.transition = 'none'
      g.sheet.style.willChange = 'transform'
    }
    e.preventDefault()
    const now = performance.now()
    g.v = (t.clientY - g.lastY) / Math.max(1, now - g.lastT)
    g.lastY = t.clientY
    g.lastT = now
    const y = dy >= 0 ? dy : -Math.min(24, Math.sqrt(-dy) * 3) // rubber-band upward
    g.sheet.style.transform = `translateY(${y}px)`
    g.backdrop.style.transition = 'none'
  }

  const onEnd = () => {
    const s = g
    g = null
    if (!s?.dragging) return
    const m = /translateY\((-?[\d.]+)px\)/.exec(s.sheet.style.transform)
    const y = m ? parseFloat(m[1]) : 0
    const settle = () => {
      s.sheet.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)'
      s.sheet.style.transform = 'translateY(0)'
      setTimeout(() => { s.sheet.style.transition = ''; s.sheet.style.willChange = '' }, 300)
    }
    if (y > DISMISS_PX || (y > 24 && s.v > DISMISS_VELOCITY)) {
      s.sheet.style.transition = 'transform 0.2s ease-in'
      s.sheet.style.transform = 'translateY(105%)'
      setTimeout(() => {
        // The backdrop's own tap handler closes the sheet.
        s.backdrop.click()
        // If nothing closed it (a sheet without tap-to-close), put it back.
        setTimeout(() => { if (document.contains(s.sheet)) settle() }, 350)
      }, 170)
    } else {
      settle()
    }
  }

  document.addEventListener('touchstart', onStart, { passive: true })
  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onEnd)
  document.addEventListener('touchcancel', onEnd)
}
