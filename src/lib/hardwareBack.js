import { useEffect } from 'react'

// Android hardware back button (Phase 4). App.jsx fires this event first;
// an open sheet or modal that handles it calls event.preventDefault() and
// closes itself, so Back closes the sheet instead of leaving the page.
export const HARDWARE_BACK_EVENT = 'ts:hardware-back'

/** Close something on Android Back while `active` is true. */
export function useHardwareBack(active, onBack) {
  useEffect(() => {
    if (!active) return
    const handler = (e) => { e.preventDefault(); onBack() }
    window.addEventListener(HARDWARE_BACK_EVENT, handler)
    return () => window.removeEventListener(HARDWARE_BACK_EVENT, handler)
  }, [active, onBack])
}
