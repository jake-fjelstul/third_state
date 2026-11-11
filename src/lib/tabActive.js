import { createContext, useContext, useEffect, useRef } from 'react'

// True when this tab page is the one on screen (and nothing is pushed over it).
// Tab pages stay mounted while hidden, so they use this to refresh on return.
export const TabActiveContext = createContext(true)

export function useIsTabActive() {
  return useContext(TabActiveContext)
}

/**
 * Run `refresh` when this tab comes back on screen, at most once per
 * `staleMs`. The first mount is skipped: pages already load on mount.
 */
export function useRefreshOnTabReturn(refresh, staleMs = 60_000) {
  const active = useIsTabActive()
  const lastRun = useRef(Date.now())
  const wasActive = useRef(active)
  const fn = useRef(refresh)
  useEffect(() => { fn.current = refresh })
  useEffect(() => {
    const cameBack = active && !wasActive.current
    wasActive.current = active
    if (!cameBack) return
    if (Date.now() - lastRun.current < staleMs) return
    lastRun.current = Date.now()
    fn.current?.()
  }, [active, staleMs])
}

/**
 * Back for a pushed screen: pop the stack when there is in-app history,
 * otherwise (cold-opened from a link or push) go to the screen's parent.
 */
export function canGoBack() {
  return (window.history.state?.idx ?? 0) > 0
}

/** Pop back if there's in-app history, otherwise replace with `fallback`. */
export function goBackOr(navigate, fallback) {
  if (canGoBack()) navigate(-1)
  else navigate(fallback, { replace: true })
}
