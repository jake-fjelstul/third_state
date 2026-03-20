import { useState, useEffect, useCallback } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/calendar.events'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function useGoogleCalendar() {
  const [isConnected,    setIsConnected]    = useState(false)
  const [isLoading,      setIsLoading]      = useState(false)
  const [googleEvents,   setGoogleEvents]   = useState([])
  const [error,          setError]          = useState(null)
  const [tokenClient,    setTokenClient]    = useState(null)
  const [accessToken,    setAccessToken]    = useState(
    () => sessionStorage.getItem('gcal_token') ?? null
  )

  // Load Google Identity Services script
  useEffect(() => {
    if (window.google) return
    const script = document.createElement('script')
    script.src   = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initTokenClient
    document.head.appendChild(script)
    return () => document.head.removeChild(script)
  }, [])

  // If we already have a token, fetch events on mount
  useEffect(() => {
    if (accessToken) {
      setIsConnected(true)
      fetchEvents(accessToken)
    }
  }, [accessToken])

  const initTokenClient = () => {
    if (!window.google || !CLIENT_ID) return null
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          setError(response.error)
          setIsLoading(false)
          return
        }
        const token = response.access_token
        sessionStorage.setItem('gcal_token', token)
        setAccessToken(token)
        setIsConnected(true)
        setIsLoading(false)
        await fetchEvents(token)
      },
    })
    setTokenClient(client)
    return client
  }

  useEffect(() => {
    if (window.google) initTokenClient()
  }, [])

  const connect = useCallback(() => {
    let client = tokenClient
    if (!client) {
      // Script not loaded yet — try reinitializing
      client = initTokenClient()
      if (!client) {
        setIsLoading(false)
        return
      }
    }
    setIsLoading(true)
    setError(null)
    client.requestAccessToken({ prompt: 'consent' })
  }, [tokenClient])

  const disconnect = useCallback(() => {
    if (accessToken && window.google) {
      window.google.accounts.oauth2.revoke(accessToken, () => {})
    }
    sessionStorage.removeItem('gcal_token')
    setAccessToken(null)
    setIsConnected(false)
    setGoogleEvents([])
  }, [accessToken])

  const fetchEvents = useCallback(async (token) => {
    try {
      setIsLoading(true)
      // Get events for current month +/- 2 weeks
      const now       = new Date()
      const timeMin   = new Date(now)
      timeMin.setDate(timeMin.getDate() - 14)
      const timeMax   = new Date(now)
      timeMax.setDate(timeMax.getDate() + 60)

      const params = new URLSearchParams({
        timeMin:      timeMin.toISOString(),
        timeMax:      timeMax.toISOString(),
        singleEvents: 'true',
        orderBy:      'startTime',
        maxResults:   '100',
      })

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.status === 401) {
        // Token expired
        sessionStorage.removeItem('gcal_token')
        setIsConnected(false)
        setAccessToken(null)
        setIsLoading(false)
        return
      }

      const data = await res.json()
      setGoogleEvents(data.items ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addEventToGoogle = useCallback(async (event) => {
    if (!accessToken) return
    try {
      const startDateTime = new Date(`${event.date}T${event.time ?? '09:00'}`)
      const endDateTime   = new Date(startDateTime)
      endDateTime.setHours(endDateTime.getHours() + 1)

      const body = {
        summary:     event.title,
        location:    event.location ?? '',
        description: `Third Space event${event.circleName ? ` · ${event.circleName}` : ''}`,
        start: { 
          dateTime: startDateTime.toISOString(), 
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
        },
        end:   { 
          dateTime: endDateTime.toISOString(),   
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
        },
        colorId: '9', // blueberry — closest to indigo
      }

      await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method:  'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )
      // Refresh events after adding
      await fetchEvents(accessToken)
    } catch (err) {
      setError(err.message)
    }
  }, [accessToken, fetchEvents])

  return {
    isConfigured: !!CLIENT_ID,
    isConnected,
    isLoading,
    googleEvents,
    error,
    connect,
    disconnect,
    addEventToGoogle,
    refetch: () => accessToken && fetchEvents(accessToken),
  }
}
