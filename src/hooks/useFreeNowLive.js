import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uniqueTopic } from '../lib/realtimeTopic.js'

/**
 * Keeps Free now current (plan 3b, R3).
 *
 * - Realtime on lfg_posts and lfg_joins: any change I'm allowed to see calls
 *   `refresh`, debounced so a burst (someone posts, two people pull up) is one
 *   refetch. RLS decides which rows reach me.
 * - A post that ends stops passing RLS, so its UPDATE never reaches other
 *   people. A once-a-minute refetch (while the app is in front) covers that,
 *   and returning to the app refetches straight away.
 * - Returns `now`, ticking every 30 s, so countdowns move and expired posts
 *   drop out without waiting for the server.
 */
export function useFreeNowLive(refresh, { enabled = true } = {}) {
  const [now, setNow] = useState(() => Date.now())
  const fn = useRef(refresh)
  useEffect(() => { fn.current = refresh })

  useEffect(() => {
    if (!enabled) return
    let timer = null
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => fn.current?.(), 400)
    }

    const channel = supabase
      .channel(uniqueTopic('free-now'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lfg_posts' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lfg_joins' }, soon)
      .subscribe()

    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const poll = setInterval(() => { if (visible()) fn.current?.() }, 60_000)
    const onVisible = () => { if (visible()) { setNow(Date.now()); soon() } }
    document.addEventListener('visibilitychange', onVisible)

    // Native: the WebView may not fire visibilitychange on resume.
    let appHandle = null
    let stopped = false
    import('@capacitor/core').then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return
      const { App } = await import('@capacitor/app')
      const h = await App.addListener('appStateChange', s => { if (s.isActive) onVisible() })
      if (stopped) h.remove(); else appHandle = h
    }).catch(() => {})

    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(tick)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      appHandle?.remove()
      supabase.removeChannel(channel)
    }
  }, [enabled])

  return now
}
