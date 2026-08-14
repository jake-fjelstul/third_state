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
    if (error?.status === 401 || data?.error === 'invalid_grant' || data?.error === 'Not connected') {
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

export async function addEventToCalendar(unusedToken, event) {
  const eventData = event || unusedToken
  const token = await getAccessToken()
  if (!token) throw new Error('Calendar is not connected')

  const startDateTime = parseEventStart(eventData)
  const endDateTime = parseEventEnd(eventData)
  const body = {
    summary: eventData.title,
    location: eventData.location ?? '',
    description: `Third Space event${eventData.circleName ? ` · ${eventData.circleName}` : ''}`,
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

  if (res.status === 401) {
    cachedAccessToken = null
    cachedTokenExpiry = 0
    setStoredCalendarToken(null)
    throw new Error('Calendar session expired. Please reconnect Google Calendar.')
  }

  if (!res.ok) throw new Error('Could not add event to calendar')
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
