import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Height in px of the on-screen keyboard, 0 when hidden.
 *
 * capacitor.config.json sets Keyboard resize "none", so the WebView never
 * shrinks: anything that must stay visible above the keyboard (composers,
 * search results in sheets) has to pad itself by this amount.
 * Native: Capacitor Keyboard events. Web: visualViewport.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    let mounted = true
    const handles = []

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/keyboard').then(async ({ Keyboard }) => {
        if (!mounted) return
        const show = await Keyboard.addListener('keyboardWillShow', (info) => {
          if (mounted) setHeight(info?.keyboardHeight || 0)
        })
        const hide = await Keyboard.addListener('keyboardWillHide', () => {
          if (mounted) setHeight(0)
        })
        if (!mounted) { show.remove(); hide.remove(); return }
        handles.push(show, hide)
      }).catch(() => {})
      return () => {
        mounted = false
        handles.forEach(h => h.remove())
      }
    }

    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return () => { mounted = false }
    const onResize = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop
      setHeight(covered > 80 ? Math.round(covered) : 0)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      mounted = false
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  return height
}

const FIELD = /^(INPUT|TEXTAREA|SELECT)$/

/**
 * For pages that scroll the whole document (sign-up, reset password): returns
 * the keyboard height so the page can pad its bottom by it, and scrolls the
 * focused field to the middle of what's still visible, both when the keyboard
 * opens and when focus moves to another field while it's open.
 */
export function useKeyboardAvoidance() {
  const kb = useKeyboardHeight()

  useEffect(() => {
    if (!kb) return
    const reveal = () => {
      const el = document.activeElement
      if (el && FIELD.test(el.tagName)) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    // Two frames: let the page re-render with its new bottom padding first.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(reveal) })
    const onFocus = (e) => { if (FIELD.test(e.target?.tagName || '')) setTimeout(reveal, 50) }
    document.addEventListener('focusin', onFocus)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      document.removeEventListener('focusin', onFocus)
    }
  }, [kb])

  return kb
}
