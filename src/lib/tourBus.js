// Tiny bus for the first-run tour: who has seen it, and "play it again".
const key = (uid) => `ts-tour-seen:${uid}`
export const START_TOUR_EVENT = 'ts:start-tour'
let pending = false

export function tourSeen(uid) {
  try { return localStorage.getItem(key(uid)) === '1' } catch { return true }
}
export function markTourSeen(uid) {
  try { localStorage.setItem(key(uid), '1') } catch { /* private mode: the tour just shows again */ }
}
export function requestTour() {
  pending = true
  window.dispatchEvent(new Event(START_TOUR_EVENT))
}
export function consumeTourRequest() {
  const was = pending
  pending = false
  return was
}
