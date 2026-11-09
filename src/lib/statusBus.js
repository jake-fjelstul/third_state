// Links the "+" status button in the top bar to the Feed, which owns the
// free-now data and sheets. The Feed publishes my live status; the button
// asks the Feed to open the create sheet (no status) or my status sheet.
import { useEffect, useState } from 'react'

let myStatus = null
const listeners = new Set()

export function publishMyStatus(post) {
  myStatus = post || null
  listeners.forEach(fn => fn(myStatus))
}

export function useMyStatus() {
  const [value, setValue] = useState(myStatus)
  useEffect(() => {
    listeners.add(setValue)
    setValue(myStatus)
    return () => listeners.delete(setValue)
  }, [])
  return value
}

export const OPEN_STATUS_EVENT = 'ts:open-status'
let pendingOpen = false
export function requestOpenStatus() {
  pendingOpen = true
  window.dispatchEvent(new Event(OPEN_STATUS_EVENT))
}
/** The Feed calls this when it handles a request (also on mount, for requests made from another tab). */
export function consumeOpenStatus() {
  const was = pendingOpen
  pendingOpen = false
  return was
}
