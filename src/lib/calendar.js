import { toLocalDateString, parseLocalDate } from './events.js'
import { supabase } from './supabase'
import { Capacitor } from '@capacitor/core'

const TOKEN_KEY = 'ts.calendar.token'

let cachedAccessToken = null
let cachedTokenExpiry = 0

export function isCalendarConfigured() {
  return true
}

export async function isCalendarConnected() {
  try {
    const { data, error } = await supabase.rpc('has_calendar_connection')
    if (error) return false
    return !!data
  } catch {
    return false
  }
}

export function getStoredCalendarToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredCalendarToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new CustomEvent('ts:calendar-token', { detail: token || null }))
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedTokenExpiry - 60000) {
    return cachedAccessToken
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const jwt = sessionData?.session?.access_token
  if (!jwt) throw new Error('Not authenticated')

  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'token' },
    headers: { Authorization: `Bearer ${jwt}` },
  })

  if (error || !data?.access_token) {
    cachedAccessToken = null
    cachedTokenExpiry = 0
    // FunctionsHttpError keeps the HTTP status on error.context (audit M14).
    const status = error?.context?.status ?? error?.status
    let errBody = data
    if (error?.context?.json) { try { errBody = await error.context.clone().json() } catch { /* not json */ } }
    if (status === 401 || errBody?.error === 'invalid_grant' || errBody?.error === 'Not connected') {
      setStoredCalendarToken(null)
      throw new Error('Calendar session expired. Please reconnect Google Calendar.')
    }
    throw new Error(data?.error || error?.message || 'Could not get calendar access token')
  }

  cachedAccessToken = data.access_token
  cachedTokenExpiry = Date.now() + 3500 * 1000
  setStoredCalendarToken('connected')
  return cachedAccessToken
}

export async function connectCalendar() {
  const { data: sessionData } = await supabase.auth.getSession()
  const jwt = sessionData?.session?.access_token
  if (!jwt) throw new Error('You must be signed in to connect Google Calendar.')

  const isNative = Capacitor.isNativePlatform()
  const webRedirectUrl = `${window.location.origin}/schedule?calendar_ok=1`

  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'start', platform: isNative ? 'native' : 'web', webRedirectUrl },
    headers: { Authorization: `Bearer ${jwt}` },
  })

  if (error || !data?.url) {
    throw new Error(error?.message || data?.error || 'Could not start Google authorization.')
  }

  const authUrl = data.url

  if (isNative) {
    const { Browser } = await import('@capacitor/browser')
    const { App: CapApp } = await import('@capacitor/app')

    return new Promise((resolve, reject) => {
      let urlListener = null
      let finishListener = null
      let settled = false
      let timeoutId = null

      const cleanup = () => {
        if (urlListener) { try { urlListener.remove() } catch {} urlListener = null }
        if (finishListener) { try { finishListener.remove() } catch {} finishListener = null }
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
      }

      const settle = (fn, value) => {
        if (settled) return
        settled = true
        cleanup()
        fn(value)
      }

      CapApp.addListener('appUrlOpen', async (event) => {
        const url = event?.url || ''
        if (
          url.startsWith('com.thirdspace.social://calendar-callback') ||
          url.startsWith('thirdspace://calendar-callback')
        ) {
          try { await Browser.close() } catch {}
          setStoredCalendarToken('connected')
          settle(resolve, { ok: true })
        }
      }).then((handle) => {
        if (settled) { try { handle.remove() } catch {}; return }
        urlListener = handle
      }).catch(() => {})

      Browser.addListener('browserFinished', () => {
        settle(reject, new Error('Google Calendar connection was cancelled.'))
      }).then((handle) => {
        if (settled) { try { handle.remove() } catch {}; return }
        finishListener = handle
      }).catch(() => {})

      timeoutId = setTimeout(() => {
        settle(reject, new Error('Google Calendar connection timed out. Please try again.'))
      }, 180000)

      Browser.open({ url: authUrl }).catch((err) => {
        settle(reject, err instanceof Error ? err : new Error('Could not open Google sign-in.'))
      })
    })
  } else {
    window.location.href = authUrl
  }
}

export async function disconnectCalendar() {
  try {
    await supabase.rpc('disconnect_calendar')
  } catch (rpcErr) {
    console.warn('[disconnectCalendar] RPC error, trying function fallback', rpcErr)
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const jwt = sessionData?.session?.access_token
    if (jwt) {
      await supabase.functions.invoke('google-calendar', {
        body: { action: 'disconnect' },
        headers: { Authorization: `Bearer ${jwt}` },
      })
    }
  } catch (fnErr) {
    console.warn('[disconnectCalendar] Edge function disconnect error', fnErr)
  }

  cachedAccessToken = null
  cachedTokenExpiry = 0
  setStoredCalendarToken(null)
}

function parseEventStart(event) {
  if (event?.dateObj) return new Date(event.dateObj)
  if (event?.start?.dateTime) return new Date(event.start.dateTime)
  if (event?.start?.date) return parseLocalDate(event.start.date)
  const date = event?.date || toLocalDateString(new Date())
  const time = event?.time || '09:00'
  return new Date(`${date}T${time}`)
}

// Real end time when we have one, else the event's duration, else 90 minutes
// (the same default availability uses). It was always one hour.
function parseEventEnd(event) {
  if (event?.endsAt) return new Date(event.endsAt)
  if (event?.end?.dateTime) return new Date(event.end.dateTime)
  const start = parseEventStart(event)
  const minutes = Number(event?.durationMinutes) > 0 ? Number(event.durationMinutes) : 90
  return new Date(start.getTime() + minutes * 60000)
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

const DEFAULT_DESCRIPTION_PREFIX = 'Third Space event'

/**
 * The Google Calendar event id we use for a Third Space event. Google lets the
 * client choose ids (base32hex: 0-9 and a-v, 5-1024 chars), and a UUID's hex
 * digits fit, so the same event always maps to the same Google id and Google
 * rejects a second copy with 409.
 */
export function googleIdFor(event) {
  const id = String(event?.id || '').toLowerCase().replace(/-/g, '')
  return /^[0-9a-f]{32}$/.test(id) ? `ts${id}` : null
}

/** The Third Space event a Google event was copied from, if any. */
export function thirdSpaceIdOf(googleEvent) {
  return googleEvent?.extendedProperties?.private?.thirdSpaceEventId || null
}

/**
 * True when a Google event is our own copy of `event`. Covers copies added
 * before ids were fixed (matched by title, start and our description).
 */
export function isCopyOf(googleEvent, event) {
  if (!googleEvent || !event) return false
  if (thirdSpaceIdOf(googleEvent) && thirdSpaceIdOf(googleEvent) === event.id) return true
  const gid = googleIdFor(event)
  if (gid && googleEvent.id === gid) return true
  if (!String(googleEvent.description || '').startsWith(DEFAULT_DESCRIPTION_PREFIX)) return false
  if ((googleEvent.summary || '') !== (event.title || '')) return false
  const gStart = googleEvent.start?.dateTime ? new Date(googleEvent.start.dateTime).getTime() : NaN
  let tStart = NaN
  try { tStart = parseEventStart(event).getTime() } catch { /* no start */ }
  return Number.isFinite(gStart) && Number.isFinite(tStart) && Math.abs(gStart - tStart) < 60000
}

async function calendarFetch(path, init = {}) {
  const token = await getAccessToken()
  if (!token) throw new Error('Calendar is not connected')
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/${path}`, {
    ...init,
    headers: { ...authHeader(token), 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (res.status === 401) {
    cachedAccessToken = null
    cachedTokenExpiry = 0
    setStoredCalendarToken(null)
    throw new Error('Calendar session expired. Please reconnect Google Calendar.')
  }
  return res
}

/** Old copies (from before fixed ids) of this event within a minute of its start. */
async function findLegacyCopy(event) {
  let start
  try { start = parseEventStart(event) } catch { return null }
  const params = new URLSearchParams({
    timeMin: new Date(start.getTime() - 60000).toISOString(),
    timeMax: new Date(start.getTime() + 60000).toISOString(),
    singleEvents: 'true',
    q: event.title || '',
    maxResults: '20',
  })
  const res = await calendarFetch(`events?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  return (data.items || []).find(g => g.status !== 'cancelled' && isCopyOf(g, event)) || null
}

/** Is this Third Space event already on the user's Google Calendar? */
export async function isEventInCalendar(event) {
  const gid = googleIdFor(event)
  if (gid) {
    const res = await calendarFetch(`events/${gid}`)
    if (res.ok) {
      const g = await res.json()
      if (g.status !== 'cancelled') return true
    }
  }
  return !!(await findLegacyCopy(event))
}

/**
 * Add a Third Space event to Google Calendar, at most once. Returns
 * 'added' or 'already' (it was there, or a deleted copy was restored).
 */
export async function addEventToCalendar(unusedToken, event) {
  const eventData = event || unusedToken
  const startDateTime = parseEventStart(eventData)
  const endDateTime = parseEventEnd(eventData)
  const gid = googleIdFor(eventData)
  const body = {
    summary: eventData.title,
    location: eventData.location ?? '',
    description: `${DEFAULT_DESCRIPTION_PREFIX}${eventData.circleName ? ` · ${eventData.circleName}` : ''}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    colorId: '9',
    extendedProperties: { private: { thirdSpaceEventId: String(eventData.id || '') } },
  }

  // A copy made before fixed ids existed counts as already added.
  if (await findLegacyCopy(eventData)) return 'already'

  const res = await calendarFetch('events', {
    method: 'POST',
    body: JSON.stringify(gid ? { ...body, id: gid } : body),
  })
  if (res.ok) return 'added'

  if (res.status === 409 && gid) {
    // Same id already exists. If it was deleted, Google keeps the id, so
    // bring it back with the current details instead of failing.
    const existing = await calendarFetch(`events/${gid}`)
    if (existing.ok && (await existing.json()).status !== 'cancelled') return 'already'
    const restored = await calendarFetch(`events/${gid}`, {
      method: 'PUT',
      body: JSON.stringify({ ...body, status: 'confirmed' }),
    })
    if (restored.ok) return 'added'
  }

  throw new Error('Could not add event to calendar')
}

export async function listExternalEvents(unusedToken, { from, to } = {}) {
  let opts = { from, to }
  if (unusedToken && typeof unusedToken === 'object' && !Array.isArray(unusedToken)) {
    opts = unusedToken
  }

  let token = null
  try {
    token = await getAccessToken()
  } catch (err) {
    return []
  }

  if (!token) return []

  const now = new Date()
  const timeMin = opts.from ? new Date(opts.from) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const timeMax = opts.to ? new Date(opts.to) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  })

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: authHeader(token),
  })

  if (res.status === 401) {
    cachedAccessToken = null
    cachedTokenExpiry = 0
    setStoredCalendarToken(null)
    throw new Error('Calendar session expired. Please reconnect Google Calendar.')
  }

  if (!res.ok) throw new Error('Could not fetch calendar events')
  const data = await res.json()
  return data.items || []
}
