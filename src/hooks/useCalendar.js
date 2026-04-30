import { useCallback, useEffect, useState } from 'react'
import {
  addEventToCalendar,
  connectCalendar,
  disconnectCalendar,
  getStoredCalendarToken,
  isCalendarConfigured,
  listExternalEvents,
  setStoredCalendarToken,
} from '../lib/calendar'

export function useCalendar() {
  const [token, setToken] = useState(() => getStoredCalendarToken())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async (activeToken = token) => {
    if (!activeToken) {
      setEvents([])
      return []
    }
    const list = await listExternalEvents(activeToken)
    setEvents(list)
    return list
  }, [token])

  const connect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { token: nextToken } = await connectCalendar()
      setStoredCalendarToken(nextToken)
      setToken(nextToken)
      await refresh(nextToken)
    } catch (e) {
      setError(e?.message || 'Could not connect calendar')
    } finally {
      setLoading(false)
    }
  }, [refresh])

  const disconnect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await disconnectCalendar(token)
      setStoredCalendarToken(null)
      setToken(null)
      setEvents([])
    } catch (e) {
      setError(e?.message || 'Could not disconnect calendar')
    } finally {
      setLoading(false)
    }
  }, [token])

  const addEvent = useCallback(async (event) => {
    if (!token) throw new Error('Calendar is not connected')
    setError(null)
    try {
      await addEventToCalendar(token, event)
      await refresh(token)
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('expired')) {
        setStoredCalendarToken(null)
        setToken(null)
      }
      setError(e?.message || 'Could not add event')
      throw e
    }
  }, [token, refresh])

  useEffect(() => {
    if (!token) return
    refresh(token).catch((e) => {
      if (String(e?.message || '').toLowerCase().includes('expired')) {
        setStoredCalendarToken(null)
        setToken(null)
      } else {
        setError(e?.message || 'Could not load calendar events')
      }
    })
  }, [token, refresh])

  useEffect(() => {
    const onTokenChange = (evt) => {
      setToken(evt.detail || getStoredCalendarToken())
    }
    window.addEventListener('ts:calendar-token', onTokenChange)
    return () => window.removeEventListener('ts:calendar-token', onTokenChange)
  }, [])

  return {
    isConfigured: isCalendarConfigured(),
    isConnected: !!token,
    isLoading: loading,
    error,
    googleEvents: events,
    connect,
    disconnect,
    addEventToGoogle: addEvent,
    refetch: () => refresh(token),
  }
}
