// Last-known data per screen, so a cold start renders immediately and the
// network only refreshes it (issue 5). Scoped to the signed-in user and wiped
// on sign-out.

const PREFIX = 'ts.cache.'
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000

let scope = 'anon'
export function setCacheScope(userId) { scope = userId || 'anon' }

const fullKey = (key) => `${PREFIX}${scope}.${key}`

export function readCache(key, { maxAgeMs = DEFAULT_MAX_AGE, revive } = {}) {
  try {
    const raw = window.localStorage.getItem(fullKey(key))
    if (!raw) return null
    const { t, d } = JSON.parse(raw)
    if (!t || Date.now() - t > maxAgeMs) return null
    return revive ? revive(d) : d
  } catch {
    return null
  }
}

export function writeCache(key, data) {
  try { window.localStorage.setItem(fullKey(key), JSON.stringify({ t: Date.now(), d: data })) } catch { /* quota */ }
}

export function clearLocalCache() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(PREFIX)) window.localStorage.removeItem(k)
    }
  } catch { /* noop */ }
}

/** Mapped events carry a Date; JSON turns it into a string. */
export const reviveEvents = (list) =>
  Array.isArray(list) ? list.map(e => ({ ...e, dateObj: e.startsAt ? new Date(e.startsAt) : null })) : list
