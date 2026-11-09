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
