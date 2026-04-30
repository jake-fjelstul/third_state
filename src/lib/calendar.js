const SCOPES = 'https://www.googleapis.com/auth/calendar.events'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const TOKEN_KEY = 'ts.calendar.token'

let tokenClient = null
let gisScriptPromise = null

const isNative = () => false // TODO Phase 8 Part B: real native check

export function isCalendarConfigured() {
  return !!CLIENT_ID
}

export function isCalendarTokenStored() {
  return !!getStoredCalendarToken()
}

export function getStoredCalendarToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredCalendarToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new CustomEvent('ts:calendar-token', { detail: token || null }))
}

function ensureGisLoaded() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisScriptPromise) return gisScriptPromise
  gisScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

async function getTokenClient() {
  await ensureGisLoaded()
  if (!CLIENT_ID) throw new Error('Google Calendar is not configured')
  if (tokenClient) return tokenClient
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  })
  return tokenClient
}

function parseEventStart(event) {
  if (event?.dateObj) return new Date(event.dateObj)
  if (event?.start?.dateTime) return new Date(event.start.dateTime)
  if (event?.start?.date) return new Date(event.start.date)
  const date = event?.date || new Date().toISOString().slice(0, 10)
  const time = event?.time || '09:00'
  return new Date(`${date}T${time}`)
}

function parseEventEnd(event) {
  const start = parseEventStart(event)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return end
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

function clearOnUnauthorized(status) {
  if (status === 401) {
    setStoredCalendarToken(null)
    throw new Error('Calendar session expired. Please reconnect Google Calendar.')
  }
}

export async function connectCalendar() {
  if (isNative()) throw new Error('Native calendar support is not enabled yet')
  const client = await getTokenClient()
  return await new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response?.error) return reject(new Error(response.error))
      if (!response?.access_token) return reject(new Error('Google did not return an access token'))
      resolve({ token: response.access_token })
    }
    client.requestAccessToken({ prompt: 'consent' })
  })
}

export async function disconnectCalendar(token) {
  if (isNative()) return
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {})
  }
  setStoredCalendarToken(null)
}

export async function addEventToCalendar(token, event) {
  if (!token) throw new Error('Calendar is not connected')
  const startDateTime = parseEventStart(event)
  const endDateTime = parseEventEnd(event)
  const body = {
    summary: event.title,
    location: event.location ?? '',
    description: `Third Space event${event.circleName ? ` · ${event.circleName}` : ''}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    colorId: '9',
  }
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  clearOnUnauthorized(res.status)
  if (!res.ok) throw new Error('Could not add event to calendar')
}

export async function listExternalEvents(token, { from, to } = {}) {
  if (!token) return []
  const now = new Date()
  const timeMin = from ? new Date(from) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const timeMax = to ? new Date(to) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
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
  clearOnUnauthorized(res.status)
  if (!res.ok) throw new Error('Could not fetch calendar events')
  const data = await res.json()
  return data.items || []
}

// TODO: Phase 11 — server-stored refresh tokens for true persistence.
