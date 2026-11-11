import { useCallback, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/*
 * React Router's navigate() changes identity on every route change. Effects
 * that register native listeners with it in their deps re-run after each
 * navigation, which replayed the launch URL in a loop (QR join bug, J7).
 * This one never changes, so listener effects run once.
 */
export function useStableNavigate() {
  const navigate = useNavigate()
  const ref = useRef(navigate)
  useLayoutEffect(() => { ref.current = navigate }, [navigate])
  return useCallback((...args) => ref.current(...args), [])
}
